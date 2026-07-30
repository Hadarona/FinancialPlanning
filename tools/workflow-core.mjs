import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const STATE_RELATIVE_PATH = ".workflow/state.json";
const MANIFEST_RELATIVE_PATH = "workflow/sprint-manifest.json";
const VALID_ROLES = new Set(["developer", "qa", "design"]);
const VALID_STATES = new Set([
  "ready",
  "iteration_in_progress",
  "needs_fix",
  "awaiting_user_feedback",
  "completed",
]);

export class WorkflowError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "WorkflowError";
    this.details = details;
  }
}

function timestamp() {
  return new Date().toISOString();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    throw new WorkflowError(`Cannot read ${filePath}`, [error.message]);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new WorkflowError(`Invalid JSON in ${filePath}`, [error.message]);
  }
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

function requireArray(value, field, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  return value;
}

function requireString(value, field, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${field} must be a non-empty string`);
    return "";
  }
  return value;
}

function validateReportIdentity(report, expected, errors) {
  if (report?._template === true) {
    errors.push("report is still marked as a template");
  }
  if (report?.schemaVersion !== 1) {
    errors.push("schemaVersion must equal 1");
  }
  if (report?.sprintId !== expected.sprintId) {
    errors.push(`sprintId must equal ${expected.sprintId}`);
  }
  if (report?.iteration !== expected.iteration) {
    errors.push(`iteration must equal ${expected.iteration}`);
  }
  if (report?.role !== expected.role) {
    errors.push(`role must equal ${expected.role}`);
  }
}

function validateDeveloperReport(report, expected) {
  const errors = [];
  validateReportIdentity(report, { ...expected, role: "developer" }, errors);

  if (!["pass", "fail", "blocked"].includes(report?.status)) {
    errors.push("developer status must be pass, fail, or blocked");
  }

  const commands = requireArray(report?.commands, "commands", errors);
  const checks = requireArray(report?.acceptanceChecks, "acceptanceChecks", errors);
  const issues = requireArray(report?.openIssues, "openIssues", errors);
  requireArray(report?.changedFiles, "changedFiles", errors);

  if (commands.length === 0) {
    errors.push("developer commands must contain at least one executed check");
  }
  if (checks.length === 0) {
    errors.push("acceptanceChecks must contain at least one check");
  }

  for (const [index, check] of checks.entries()) {
    requireString(check?.id, `acceptanceChecks[${index}].id`, errors);
    if (!["passed", "failed", "not_applicable"].includes(check?.status)) {
      errors.push(`acceptanceChecks[${index}].status is invalid`);
    }
    if (check?.status === "not_applicable" && !String(check?.reason ?? "").trim()) {
      errors.push(`acceptanceChecks[${index}] needs a not-applicable reason`);
    }
    if (check?.status === "passed" && !String(check?.evidence ?? "").trim()) {
      errors.push(`acceptanceChecks[${index}] needs evidence`);
    }
  }

  if (report?.status === "pass") {
    if (issues.length > 0) {
      errors.push("a passing developer report cannot contain open issues");
    }
    if (checks.some((check) => !["passed", "not_applicable"].includes(check?.status))) {
      errors.push("all developer acceptance checks must pass or be justified not-applicable");
    }
  }

  return errors;
}

function validateQaReport(report, expected) {
  const errors = [];
  validateReportIdentity(report, { ...expected, role: "qa" }, errors);

  if (!["pass", "product_issues", "blocked"].includes(report?.status)) {
    errors.push("QA status must be pass, product_issues, or blocked");
  }

  const tests = requireArray(report?.plannedTests, "plannedTests", errors);
  const testIssues = requireArray(report?.testIssues, "testIssues", errors);
  const productIssues = requireArray(report?.productIssues, "productIssues", errors);
  requireArray(report?.commands, "commands", errors);

  if (tests.length === 0) {
    errors.push("plannedTests must contain at least one functional test");
  }
  if (testIssues.length > 0) {
    errors.push("final QA report still contains test issues; repair and rerun them");
  }

  const productIssueIds = new Set();
  for (const [index, issue] of productIssues.entries()) {
    const id = requireString(issue?.id, `productIssues[${index}].id`, errors);
    if (id) {
      productIssueIds.add(id);
    }
    for (const field of ["severity", "title", "expected", "actual", "reproduction", "evidence", "owningArea"]) {
      requireString(issue?.[field], `productIssues[${index}].${field}`, errors);
    }
    requireArray(issue?.affectedAcceptanceIds, `productIssues[${index}].affectedAcceptanceIds`, errors);
  }

  for (const [index, test] of tests.entries()) {
    requireString(test?.id, `plannedTests[${index}].id`, errors);
    requireString(test?.title, `plannedTests[${index}].title`, errors);
    requireString(test?.layer, `plannedTests[${index}].layer`, errors);
    requireString(test?.evidence, `plannedTests[${index}].evidence`, errors);
    if (test?.stepsVerified !== true) {
      errors.push(`plannedTests[${index}] did not verify its setup, actions, and assertions`);
    }
    if (!["passed", "product_bug"].includes(test?.status)) {
      errors.push(`plannedTests[${index}].status must be passed or product_bug`);
    }
    if (test?.status === "product_bug" && !productIssueIds.has(test?.productIssueId)) {
      errors.push(`plannedTests[${index}] must reference a matching product issue`);
    }
  }

  if (report?.status === "pass" && productIssues.length > 0) {
    errors.push("QA status pass cannot contain product issues");
  }
  if (report?.status === "product_issues" && productIssues.length === 0) {
    errors.push("QA status product_issues requires at least one product issue");
  }

  return errors;
}

function validateDesignReport(report, expected) {
  const errors = [];
  validateReportIdentity(report, { ...expected, role: "design" }, errors);

  if (!["pass", "issues", "not_applicable", "blocked"].includes(report?.status)) {
    errors.push("design status must be pass, issues, not_applicable, or blocked");
  }

  const views = requireArray(report?.reviewedViews, "reviewedViews", errors);
  const issues = requireArray(report?.issues, "issues", errors);
  requireArray(report?.intentionalDifferences, "intentionalDifferences", errors);

  for (const [index, view] of views.entries()) {
    requireString(view?.screen, `reviewedViews[${index}].screen`, errors);
    requireString(view?.state, `reviewedViews[${index}].state`, errors);
    requireString(view?.evidence, `reviewedViews[${index}].evidence`, errors);
    if (!Number.isInteger(view?.viewport?.width) || !Number.isInteger(view?.viewport?.height)) {
      errors.push(`reviewedViews[${index}].viewport must contain integer width and height`);
    }
  }

  for (const [index, issue] of issues.entries()) {
    for (const field of [
      "id",
      "severity",
      "screen",
      "state",
      "category",
      "expected",
      "actual",
      "reproduction",
      "evidence",
      "changeType",
    ]) {
      requireString(issue?.[field], `issues[${index}].${field}`, errors);
    }
    requireArray(issue?.sourceRefs, `issues[${index}].sourceRefs`, errors);
    if (!Number.isInteger(issue?.viewport?.width) || !Number.isInteger(issue?.viewport?.height)) {
      errors.push(`issues[${index}].viewport must contain integer width and height`);
    }
  }

  if (report?.status === "pass") {
    if (issues.length > 0) {
      errors.push("a passing design report cannot contain issues");
    }
    if (views.length === 0) {
      errors.push("a passing design report must contain reviewed views");
    }
  }
  if (report?.status === "issues" && issues.length === 0) {
    errors.push("design status issues requires at least one issue");
  }
  if (report?.status === "not_applicable") {
    if (!String(report?.notApplicableReason ?? "").trim()) {
      errors.push("not_applicable design status requires a reason");
    }
    if (issues.length > 0) {
      errors.push("not_applicable design status cannot contain issues");
    }
  }

  return errors;
}

export async function loadManifest(root) {
  const manifestPath = path.join(root, MANIFEST_RELATIVE_PATH);
  const manifest = await readJson(manifestPath);
  const errors = [];

  if (manifest?.schemaVersion !== 1) {
    errors.push("manifest schemaVersion must equal 1");
  }
  if (!Array.isArray(manifest?.sprints) || manifest.sprints.length === 0) {
    errors.push("manifest must contain at least one sprint");
  } else {
    const ids = new Set();
    manifest.sprints.forEach((sprint, index) => {
      if (sprint?.order !== index) {
        errors.push(`sprint at index ${index} must have order ${index}`);
      }
      requireString(sprint?.id, `sprints[${index}].id`, errors);
      requireString(sprint?.title, `sprints[${index}].title`, errors);
      requireString(sprint?.roadmapHeading, `sprints[${index}].roadmapHeading`, errors);
      if (ids.has(sprint?.id)) {
        errors.push(`duplicate sprint ID ${sprint.id}`);
      }
      ids.add(sprint?.id);
    });
  }

  if (errors.length > 0) {
    throw new WorkflowError("Sprint manifest is invalid", errors);
  }
  return manifest;
}

export function createInitialState(manifest, now = timestamp()) {
  return {
    schemaVersion: 1,
    project: "budgeting-app",
    status: "ready",
    currentSprintIndex: 0,
    currentSprintId: manifest.sprints[0].id,
    iteration: 0,
    iterationLimit: 5,
    phase: "developer_plan",
    feedbackRounds: 0,
    activeFeedbackPaths: [],
    completedSprints: [],
    acceptedBaselines: [],
    lastEvaluation: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function readState(root) {
  const state = await readJson(path.join(root, STATE_RELATIVE_PATH));
  const manifest = await loadManifest(root);
  const errors = [];

  if (state?.schemaVersion !== 1) {
    errors.push("state schemaVersion must equal 1");
  }
  if (!VALID_STATES.has(state?.status)) {
    errors.push(`invalid workflow status ${state?.status}`);
  }
  if (!Number.isInteger(state?.iteration) || state.iteration < 0) {
    errors.push("iteration must be a non-negative integer");
  }
  if (!Number.isInteger(state?.iterationLimit) || state.iterationLimit < 5) {
    errors.push("iterationLimit must be an integer of at least 5");
  }
  requireArray(state?.completedSprints, "completedSprints", errors);
  requireArray(state?.acceptedBaselines, "acceptedBaselines", errors);
  requireArray(state?.activeFeedbackPaths, "activeFeedbackPaths", errors);

  if (state?.status !== "completed") {
    const sprint = manifest.sprints[state?.currentSprintIndex];
    if (!sprint || sprint.id !== state?.currentSprintId) {
      errors.push("currentSprintIndex and currentSprintId do not match the manifest");
    }
  }

  if (errors.length > 0) {
    throw new WorkflowError("Workflow state is invalid", errors);
  }
  return state;
}

export async function initWorkflow(root) {
  const statePath = path.join(root, STATE_RELATIVE_PATH);
  if (await exists(statePath)) {
    throw new WorkflowError("Workflow state already exists; refusing to overwrite it");
  }
  const manifest = await loadManifest(root);
  const state = createInitialState(manifest);
  await writeJsonAtomic(statePath, state);
  return state;
}

function iterationRelativePath(state) {
  return path.join(
    ".workflow",
    "sprints",
    state.currentSprintId,
    `iteration-${pad(state.iteration)}`,
  );
}

async function loadFeedback(root, paths) {
  const records = [];
  for (const relativePath of paths) {
    records.push(await readJson(path.join(root, relativePath)));
  }
  return records;
}

export async function startIteration(root) {
  const manifest = await loadManifest(root);
  const state = await readState(root);

  if (!["ready", "needs_fix"].includes(state.status)) {
    throw new WorkflowError(`Cannot start an iteration while workflow status is ${state.status}`);
  }
  if (state.iteration >= state.iterationLimit) {
    throw new WorkflowError("Iteration limit reached; user feedback is required");
  }

  const nextState = {
    ...state,
    iteration: state.iteration + 1,
    status: "iteration_in_progress",
    phase: "developer_plan",
    updatedAt: timestamp(),
  };
  const sprint = manifest.sprints[nextState.currentSprintIndex];
  const relativeDirectory = iterationRelativePath(nextState);
  const finalDirectory = path.join(root, relativeDirectory);
  if (await exists(finalDirectory)) {
    throw new WorkflowError(`Iteration directory already exists: ${relativeDirectory}`);
  }

  const temporaryDirectory = `${finalDirectory}.tmp-${process.pid}-${Date.now()}`;
  for (const role of ["developer", "qa", "design"]) {
    await mkdir(path.join(temporaryDirectory, role, "evidence"), { recursive: true });
  }

  const feedback = await loadFeedback(root, nextState.activeFeedbackPaths);
  const context = {
    schemaVersion: 1,
    sprintId: sprint.id,
    sprintTitle: sprint.title,
    sprintOrder: sprint.order,
    roadmapHeading: sprint.roadmapHeading,
    iteration: nextState.iteration,
    iterationLimit: nextState.iterationLimit,
    startedAt: timestamp(),
    sources: {
      requirements: "docs/product/Project_requirements_English.md",
      roadmap: "docs/product/Budgeting_App_Development_Roadmap.md",
      designKit: "docs/design/figma-kit",
      approvedScreens: "docs/design/approved-screens.md",
      sourceRules: "docs/workflow/source-of-truth.md",
    },
    feedback,
    templates: {
      developer: "workflow/templates/developer-test-report.json",
      qa: "workflow/templates/qa-run-report.json",
      design: "workflow/templates/design-review-report.json",
    },
  };

  await writeJsonAtomic(path.join(temporaryDirectory, "context.json"), context);
  await copyFile(
    path.join(root, "workflow/templates/developer-plan.md"),
    path.join(temporaryDirectory, "developer/plan.md"),
  );
  await copyFile(
    path.join(root, "workflow/templates/qa-plan.md"),
    path.join(temporaryDirectory, "qa/plan.md"),
  );
  await rename(temporaryDirectory, finalDirectory);
  await writeJsonAtomic(path.join(root, STATE_RELATIVE_PATH), nextState);

  return {
    state: nextState,
    sprint,
    iterationDirectory: relativeDirectory,
    nextAction: "spawn developer plan phase",
  };
}

async function readFinalReports(root, state) {
  const relativeDirectory = iterationRelativePath(state);
  const expected = {
    sprintId: state.currentSprintId,
    iteration: state.iteration,
  };
  const reportPaths = {
    developer: path.join(relativeDirectory, "developer/test-report.json"),
    qa: path.join(relativeDirectory, "qa/run-report.json"),
    design: path.join(relativeDirectory, "design/review-report.json"),
  };
  const missing = [];

  for (const [role, relativePath] of Object.entries(reportPaths)) {
    if (!(await exists(path.join(root, relativePath)))) {
      missing.push(`${role}: ${relativePath}`);
    }
  }
  if (missing.length > 0) {
    throw new WorkflowError("Final role reports are missing", missing);
  }

  const developer = await readJson(path.join(root, reportPaths.developer));
  const qa = await readJson(path.join(root, reportPaths.qa));
  const design = await readJson(path.join(root, reportPaths.design));
  const validationErrors = [
    ...validateDeveloperReport(developer, expected).map((item) => `developer: ${item}`),
    ...validateQaReport(qa, expected).map((item) => `qa: ${item}`),
    ...validateDesignReport(design, expected).map((item) => `design: ${item}`),
  ];

  if (validationErrors.length > 0) {
    throw new WorkflowError("Final role reports are not ready for evaluation", validationErrors);
  }

  return { developer, qa, design, reportPaths };
}

function summarizeEvaluation(reports) {
  return {
    developerStatus: reports.developer.status,
    developerIssueIds: reports.developer.openIssues.map((issue) => issue.id).filter(Boolean),
    qaStatus: reports.qa.status,
    qaProductIssueIds: reports.qa.productIssues.map((issue) => issue.id),
    designStatus: reports.design.status,
    designIssueIds: reports.design.issues.map((issue) => issue.id),
  };
}

function hasOpenGateIssue(reports) {
  return (
    reports.developer.status !== "pass" ||
    reports.developer.openIssues.length > 0 ||
    reports.qa.status !== "pass" ||
    reports.qa.productIssues.length > 0 ||
    !["pass", "not_applicable"].includes(reports.design.status) ||
    reports.design.issues.length > 0
  );
}

function advanceState(state, manifest, outcome, details = {}) {
  const completed = {
    sprintId: state.currentSprintId,
    title: manifest.sprints[state.currentSprintIndex].title,
    outcome,
    iterations: state.iteration,
    completedAt: timestamp(),
    ...details,
  };
  const currentSprintIndex = state.currentSprintIndex + 1;
  const finished = currentSprintIndex >= manifest.sprints.length;

  return {
    ...state,
    status: finished ? "completed" : "ready",
    currentSprintIndex,
    currentSprintId: finished ? null : manifest.sprints[currentSprintIndex].id,
    iteration: 0,
    iterationLimit: 5,
    phase: finished ? "complete" : "developer_plan",
    feedbackRounds: 0,
    activeFeedbackPaths: [],
    completedSprints: [...state.completedSprints, completed],
    lastEvaluation: null,
    updatedAt: timestamp(),
  };
}

export async function evaluateIteration(root) {
  const manifest = await loadManifest(root);
  const state = await readState(root);
  if (state.status !== "iteration_in_progress") {
    throw new WorkflowError(`Cannot evaluate while workflow status is ${state.status}`);
  }

  const reports = await readFinalReports(root, state);
  const summary = {
    ...summarizeEvaluation(reports),
    evaluatedAt: timestamp(),
    iteration: state.iteration,
    reportPaths: reports.reportPaths,
  };

  if (reports.developer.status !== "pass") {
    throw new WorkflowError("Developer loop has not reached a passing handoff", [
      `developer status: ${reports.developer.status}`,
    ]);
  }
  if (reports.qa.status === "blocked" || reports.design.status === "blocked") {
    throw new WorkflowError("A review role is blocked and requires resolution", [
      `qa status: ${reports.qa.status}`,
      `design status: ${reports.design.status}`,
    ]);
  }

  let nextState;
  let outcome;
  if (!hasOpenGateIssue(reports)) {
    nextState = advanceState(state, manifest, "accepted");
    outcome = "sprint_accepted";
  } else if (state.iteration >= state.iterationLimit) {
    nextState = {
      ...state,
      status: "awaiting_user_feedback",
      phase: "user_feedback",
      lastEvaluation: summary,
      updatedAt: timestamp(),
    };
    outcome = "awaiting_user_feedback";
  } else {
    nextState = {
      ...state,
      status: "needs_fix",
      phase: "developer_plan",
      lastEvaluation: summary,
      updatedAt: timestamp(),
    };
    outcome = "next_iteration_required";
  }

  await writeJsonAtomic(path.join(root, STATE_RELATIVE_PATH), nextState);
  return {
    outcome,
    evaluation: summary,
    state: nextState,
  };
}

async function fileSha256(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

export async function applyFeedback(root, options) {
  const manifest = await loadManifest(root);
  const state = await readState(root);
  if (state.status !== "awaiting_user_feedback") {
    throw new WorkflowError("Feedback can only be applied at an awaiting_user_feedback checkpoint");
  }

  const message = String(options?.message ?? "");
  if (message.trim() === "") {
    throw new WorkflowError("Feedback message cannot be empty");
  }

  const round = state.feedbackRounds + 1;
  if (options.decision === "continue") {
    const roles = [...new Set(options.roles ?? [])];
    const invalidRoles = roles.filter((role) => !VALID_ROLES.has(role));
    if (roles.length === 0 || invalidRoles.length > 0) {
      throw new WorkflowError("Continue feedback needs one or more valid addressed roles", invalidRoles);
    }

    const record = {
      schemaVersion: 1,
      decision: "continue",
      sprintId: state.currentSprintId,
      afterIteration: state.iteration,
      roles,
      message,
      createdAt: timestamp(),
    };
    const relativePath = path.join(
      ".workflow",
      "feedback",
      `${state.currentSprintId}-round-${pad(round)}.json`,
    );
    await writeJsonAtomic(path.join(root, relativePath), record);
    const nextState = {
      ...state,
      status: "needs_fix",
      phase: "developer_plan",
      iterationLimit: state.iterationLimit + 5,
      feedbackRounds: round,
      activeFeedbackPaths: [...state.activeFeedbackPaths, relativePath],
      updatedAt: timestamp(),
    };
    await writeJsonAtomic(path.join(root, STATE_RELATIVE_PATH), nextState);
    return {
      outcome: "continued",
      addedIterations: 5,
      feedbackPath: relativePath,
      state: nextState,
    };
  }

  if (options.decision === "good-enough") {
    const reports = await readFinalReports(root, state);
    const reportHashes = {};
    for (const [role, relativePath] of Object.entries(reports.reportPaths)) {
      reportHashes[role] = {
        path: relativePath,
        sha256: await fileSha256(path.join(root, relativePath)),
      };
    }

    const baseline = {
      schemaVersion: 1,
      decision: "good-enough",
      sprintId: state.currentSprintId,
      afterIteration: state.iteration,
      message,
      acceptedProductIssueIds: reports.qa.productIssues.map((issue) => issue.id),
      acceptedDesignIssueIds: reports.design.issues.map((issue) => issue.id),
      acceptedDeveloperIssueIds: reports.developer.openIssues.map((issue) => issue.id).filter(Boolean),
      reportHashes,
      createdAt: timestamp(),
    };
    const relativePath = path.join(
      ".workflow",
      "baselines",
      `${state.currentSprintId}-round-${pad(round)}.json`,
    );
    await writeJsonAtomic(path.join(root, relativePath), baseline);
    const withBaseline = {
      ...state,
      feedbackRounds: round,
      acceptedBaselines: [...state.acceptedBaselines, relativePath],
    };
    const nextState = advanceState(withBaseline, manifest, "accepted_with_exceptions", {
      baselinePath: relativePath,
    });
    await writeJsonAtomic(path.join(root, STATE_RELATIVE_PATH), nextState);
    return {
      outcome: "sprint_accepted_with_exceptions",
      baselinePath: relativePath,
      state: nextState,
    };
  }

  throw new WorkflowError(`Unknown feedback decision: ${options?.decision}`);
}

export async function statusSummary(root) {
  const manifest = await loadManifest(root);
  const state = await readState(root);
  const sprint =
    state.status === "completed" ? null : manifest.sprints[state.currentSprintIndex];
  const nextActions = {
    ready: "start the first iteration for the current sprint",
    needs_fix: "start the next fix iteration",
    iteration_in_progress: "complete role reports, then evaluate",
    awaiting_user_feedback: "wait for good-enough or continue feedback",
    completed: "workflow complete",
  };
  return {
    state,
    currentSprint: sprint,
    nextAction: nextActions[state.status],
  };
}

async function validateSourceManifest(root, errors, checked) {
  const manifestPath = path.join(root, "workflow/source-manifest.json");
  if (!(await exists(manifestPath))) {
    errors.push("missing workflow/source-manifest.json");
    return;
  }
  const sourceManifest = await readJson(manifestPath);
  const files = requireArray(sourceManifest?.files, "source-manifest files", errors);
  for (const entry of files) {
    const relativePath = entry?.path;
    if (!relativePath || !(await exists(path.join(root, relativePath)))) {
      errors.push(`missing source file ${relativePath ?? "<undefined>"}`);
      continue;
    }
    const actual = await fileSha256(path.join(root, relativePath));
    if (actual !== entry.sha256) {
      errors.push(`source hash mismatch for ${relativePath}`);
    }
    checked.push(relativePath);
  }
}

export async function validateProject(root) {
  const errors = [];
  const warnings = [];
  const checked = [];
  const requiredPaths = [
    "CLAUDE.md",
    ".claude/agents/developer.md",
    ".claude/agents/qa-engineer.md",
    ".claude/agents/design-reviewer.md",
    ".claude/skills/budget-app-developer-loop/SKILL.md",
    ".claude/skills/budget-app-qa-loop/SKILL.md",
    ".claude/skills/budget-app-design-review/SKILL.md",
    "docs/product/Project_requirements_English.md",
    "docs/product/Budgeting_App_Development_Roadmap.md",
    "docs/design/approved-screens.md",
    "docs/design/figma-kit/data/content.json",
    "docs/design/figma-kit/tokens/design-tokens.json",
    "docs/design/figma-kit/docs/figma-build-spec.md",
    "workflow/templates/developer-test-report.json",
    "workflow/templates/qa-run-report.json",
    "workflow/templates/design-review-report.json",
  ];

  for (const relativePath of requiredPaths) {
    if (!(await exists(path.join(root, relativePath)))) {
      errors.push(`missing required path ${relativePath}`);
    } else {
      checked.push(relativePath);
    }
  }

  let manifest;
  try {
    manifest = await loadManifest(root);
    checked.push(MANIFEST_RELATIVE_PATH);
  } catch (error) {
    errors.push(error.message, ...(error.details ?? []));
  }

  if (manifest && (await exists(path.join(root, "docs/product/Budgeting_App_Development_Roadmap.md")))) {
    const roadmap = await readFile(
      path.join(root, "docs/product/Budgeting_App_Development_Roadmap.md"),
      "utf8",
    );
    let previousIndex = -1;
    for (const sprint of manifest.sprints) {
      const index = roadmap.indexOf(sprint.roadmapHeading);
      if (index === -1) {
        errors.push(`roadmap heading not found: ${sprint.roadmapHeading}`);
      } else if (index <= previousIndex) {
        errors.push(`roadmap heading out of order: ${sprint.roadmapHeading}`);
      }
      previousIndex = index;
    }
  }

  const expectedAgents = [
    ["developer", ".claude/agents/developer.md"],
    ["qa-engineer", ".claude/agents/qa-engineer.md"],
    ["design-reviewer", ".claude/agents/design-reviewer.md"],
  ];
  for (const [name, relativePath] of expectedAgents) {
    const fullPath = path.join(root, relativePath);
    if (!(await exists(fullPath))) {
      continue;
    }
    const content = await readFile(fullPath, "utf8");
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!frontmatterMatch) {
      errors.push(`${relativePath} is missing YAML frontmatter`);
      continue;
    }
    const [, frontmatter, body] = frontmatterMatch;
    if (!new RegExp(`^name:\\s*${name}\\s*$`, "m").test(frontmatter)) {
      errors.push(`${relativePath} frontmatter must set name: ${name}`);
    }
    if (!/^description:\s+\S/m.test(frontmatter)) {
      errors.push(`${relativePath} is missing a non-empty description`);
    }
    if (body.trim() === "") {
      errors.push(`${relativePath} is missing agent instructions after the frontmatter`);
    }
    if (/^model:/m.test(frontmatter)) {
      errors.push(`${relativePath} must not pin a model; routing is phase-specific`);
    }
  }

  const expectedSkills = [
    ["budget-app-developer-loop", ".claude/skills/budget-app-developer-loop/SKILL.md"],
    ["budget-app-qa-loop", ".claude/skills/budget-app-qa-loop/SKILL.md"],
    ["budget-app-design-review", ".claude/skills/budget-app-design-review/SKILL.md"],
  ];
  for (const [name, relativePath] of expectedSkills) {
    const fullPath = path.join(root, relativePath);
    if (!(await exists(fullPath))) {
      continue;
    }
    const content = await readFile(fullPath, "utf8");
    if (!content.startsWith("---\n") || !content.includes(`\nname: ${name}\n`)) {
      errors.push(`${relativePath} has invalid or mismatched skill frontmatter`);
    }
    if (!/\ndescription:\s+\S/.test(content)) {
      errors.push(`${relativePath} is missing a non-empty skill description`);
    }
  }

  for (const relativePath of [
    "workflow/templates/developer-test-report.json",
    "workflow/templates/qa-run-report.json",
    "workflow/templates/design-review-report.json",
    "docs/design/figma-kit/data/content.json",
    "docs/design/figma-kit/tokens/design-tokens.json",
  ]) {
    if (await exists(path.join(root, relativePath))) {
      try {
        await readJson(path.join(root, relativePath));
      } catch (error) {
        errors.push(error.message, ...(error.details ?? []));
      }
    }
  }

  await validateSourceManifest(root, errors, checked);

  if (await exists(path.join(root, STATE_RELATIVE_PATH))) {
    try {
      await readState(root);
      checked.push(STATE_RELATIVE_PATH);
    } catch (error) {
      errors.push(error.message, ...(error.details ?? []));
    }
  } else {
    warnings.push("workflow state is not initialized");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checked: [...new Set(checked)].sort(),
  };
}

export async function writeReportsForTest(root, reports) {
  const state = await readState(root);
  const directory = path.join(root, iterationRelativePath(state));
  await writeJsonAtomic(path.join(directory, "developer/test-report.json"), reports.developer);
  await writeJsonAtomic(path.join(directory, "qa/run-report.json"), reports.qa);
  await writeJsonAtomic(path.join(directory, "design/review-report.json"), reports.design);
}
