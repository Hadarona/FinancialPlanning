import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  applyFeedback,
  evaluateIteration,
  initWorkflow,
  readState,
  startIteration,
  writeReportsForTest,
} from "../workflow-core.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "budget-workflow-"));
  await mkdir(path.join(root, "workflow/templates"), { recursive: true });
  await writeFile(
    path.join(root, "workflow/sprint-manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        roadmap: "roadmap.md",
        sprints: [
          {
            id: "sprint-0",
            order: 0,
            title: "Foundation",
            roadmapHeading: "Sprint 0 — Foundation",
          },
          {
            id: "sprint-1",
            order: 1,
            title: "Auth",
            roadmapHeading: "Sprint 1 — Auth",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(root, "workflow/templates/developer-plan.md"), "# Plan\n");
  await writeFile(path.join(root, "workflow/templates/qa-plan.md"), "# QA Plan\n");
  await initWorkflow(root);
  return root;
}

function reports(sprintId, iteration, options = {}) {
  const productIssues = options.productIssues ?? [];
  const designIssues = options.designIssues ?? [];
  return {
    developer: {
      schemaVersion: 1,
      sprintId,
      iteration,
      role: "developer",
      phase: "test",
      status: "pass",
      changedFiles: [],
      commands: [{ command: "npm test", exitCode: 0, result: "passed", evidence: "dev.log" }],
      acceptanceChecks: [
        { id: "AC-1", status: "passed", evidence: "dev.log", reason: "" },
      ],
      openIssues: [],
      notes: [],
    },
    qa: {
      schemaVersion: 1,
      sprintId,
      iteration,
      role: "qa",
      status: productIssues.length ? "product_issues" : "pass",
      commands: [],
      plannedTests: [
        {
          id: "QA-1",
          title: "journey",
          layer: "http",
          status: productIssues.length ? "product_bug" : "passed",
          stepsVerified: true,
          productIssueId: productIssues[0]?.id ?? null,
          evidence: "qa.log",
        },
      ],
      coverage: {
        frontend: 75,
        backend: 80,
        threshold: 70,
        thresholdMet: true,
        evidence: "coverage.json",
      },
      testIssues: [],
      productIssues,
      notes: [],
    },
    design: {
      schemaVersion: 1,
      sprintId,
      iteration,
      role: "design",
      status: designIssues.length ? "issues" : "pass",
      notApplicableReason: "",
      reviewedViews: [
        {
          screen: "Login",
          state: "default",
          viewport: { width: 390, height: 844 },
          evidence: "login.png",
        },
      ],
      issues: designIssues,
      intentionalDifferences: [],
      notes: [],
    },
  };
}

function productIssue(id = "QA-PROD-1") {
  return {
    id,
    severity: "high",
    title: "Wrong result",
    expected: "expected",
    actual: "actual",
    reproduction: "run journey",
    evidence: "qa.log",
    affectedAcceptanceIds: ["AC-1"],
    owningArea: "backend",
  };
}

function designIssue(id = "DES-1") {
  return {
    id,
    severity: "medium",
    screen: "Login",
    state: "default",
    viewport: { width: 390, height: 844 },
    category: "spacing",
    expected: "20 px",
    actual: "12 px",
    reproduction: "open login",
    evidence: "login.png",
    sourceRefs: ["tokens"],
    changeType: "new",
  };
}

test("natural acceptance advances to the next sprint", async () => {
  const root = await fixture();
  await startIteration(root);
  await writeReportsForTest(root, reports("sprint-0", 1));
  const result = await evaluateIteration(root);

  assert.equal(result.outcome, "sprint_accepted");
  assert.equal(result.state.currentSprintId, "sprint-1");
  assert.equal(result.state.iteration, 0);
  assert.equal(result.state.iterationLimit, 5);
});

test("QA cannot finish with a broken test issue", async () => {
  const root = await fixture();
  await startIteration(root);
  const invalid = reports("sprint-0", 1);
  invalid.qa.testIssues = [
    {
      id: "QA-TEST-1",
      title: "Fixture bypasses the intended action",
    },
  ];
  await writeReportsForTest(root, invalid);

  await assert.rejects(
    () => evaluateIteration(root),
    (error) =>
      error.message === "Final role reports are not ready for evaluation" &&
      error.details.some((detail) => detail.includes("repair and rerun")),
  );
  const state = await readState(root);
  assert.equal(state.status, "iteration_in_progress");
});

test("five unresolved outer iterations stop for user feedback", async () => {
  const root = await fixture();
  for (let iteration = 1; iteration <= 5; iteration += 1) {
    await startIteration(root);
    await writeReportsForTest(
      root,
      reports("sprint-0", iteration, {
        productIssues: [productIssue(`QA-PROD-${iteration}`)],
        designIssues: [designIssue(`DES-${iteration}`)],
      }),
    );
    const result = await evaluateIteration(root);
    assert.equal(
      result.outcome,
      iteration === 5 ? "awaiting_user_feedback" : "next_iteration_required",
    );
  }
  const state = await readState(root);
  assert.equal(state.status, "awaiting_user_feedback");
  assert.equal(state.iteration, 5);
});

test("continue adds exactly five iterations and preserves role routing", async () => {
  const root = await fixture();
  for (let iteration = 1; iteration <= 5; iteration += 1) {
    await startIteration(root);
    await writeReportsForTest(
      root,
      reports("sprint-0", iteration, { productIssues: [productIssue()] }),
    );
    await evaluateIteration(root);
  }

  const continued = await applyFeedback(root, {
    decision: "continue",
    roles: ["qa", "design"],
    message: "QA and design: continue with this new rule.",
  });
  assert.equal(continued.addedIterations, 5);
  assert.equal(continued.state.iterationLimit, 10);
  assert.deepEqual(continued.state.activeFeedbackPaths.length, 1);

  const started = await startIteration(root);
  assert.equal(started.state.iteration, 6);
});

test("good enough records a baseline and advances", async () => {
  const root = await fixture();
  for (let iteration = 1; iteration <= 5; iteration += 1) {
    await startIteration(root);
    await writeReportsForTest(
      root,
      reports("sprint-0", iteration, {
        productIssues: [productIssue()],
        designIssues: [designIssue()],
      }),
    );
    await evaluateIteration(root);
  }

  const accepted = await applyFeedback(root, {
    decision: "good-enough",
    message: "It is good enough.",
  });
  assert.equal(accepted.outcome, "sprint_accepted_with_exceptions");
  assert.equal(accepted.state.currentSprintId, "sprint-1");
  assert.equal(accepted.state.acceptedBaselines.length, 1);
  assert.equal(accepted.state.completedSprints[0].outcome, "accepted_with_exceptions");
});
