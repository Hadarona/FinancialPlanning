# Artifact Contract

All runtime evidence belongs under:

```text
.workflow/sprints/<sprint-id>/iteration-NN/
├── context.json
├── developer/
│   ├── plan.md
│   ├── build-report.md
│   ├── test-report.json
│   ├── cycle-NN/
│   └── evidence/
├── qa/
│   ├── plan.md
│   ├── build-report.md
│   ├── run-report.json
│   ├── cycle-NN/
│   └── evidence/
└── design/
    ├── review-report.md
    ├── review-report.json
    └── evidence/
```

The final report at each role root is authoritative for orchestration. Cycle
folders retain intermediate evidence and are never used as the final gate.

Use the JSON shapes in `workflow/templates/`. Do not remove fields; add
backward-compatible fields only when needed.

## Context

`context.json` contains:

- sprint ID, title, order, and roadmap heading;
- outer iteration and current iteration limit;
- phase start time;
- source paths;
- feedback records, each with addressed roles.

A role must ignore feedback that does not include its role.

## Developer final report

`developer/test-report.json` requires:

- `status`: `pass`, `fail`, or `blocked`;
- commands and evidence;
- every in-scope acceptance check and its status;
- `openIssues`;
- changed files and notes.

`pass` requires an empty `openIssues` array and every acceptance check `passed`
or explicitly `not_applicable` with a reason.

## QA final report

`qa/run-report.json` requires:

- `status`: `pass`, `product_issues`, or `blocked`;
- each planned test with layer, verified steps, status, and evidence;
- commands and coverage;
- `testIssues`;
- `productIssues`.

Allowed final planned-test statuses are:

- `passed`;
- `product_bug`, with a matching product issue ID.

`test_issue`, `failed`, `flaky`, `skipped`, `not_run`, or missing evidence
prevents final QA acceptance. The final `testIssues` array must be empty.

A product issue contains a stable ID, severity, title, expected/actual behavior,
reproduction, evidence, affected acceptance IDs, and owning area.

## Design final report

`design/review-report.json` requires:

- `status`: `pass`, `issues`, `not_applicable`, or `blocked`;
- reviewed screens/viewports and evidence;
- `issues`;
- accepted intentional differences.

Every design issue includes a stable ID, severity, screen/state, viewport,
category, expected/actual behavior, reproduction, evidence, source references,
and whether it is new or regressed.

`not_applicable` requires an explanation and an empty issue list.

## Evidence quality

- Prefer concise structured output over pasted logs.
- Keep raw command output, browser screenshots, traces, and coverage artifacts
  in the role's evidence directory.
- Use repository-relative paths.
- Redact credentials, cookies, tokens, private notes, and full financial
  request bodies.
- Never cite a file that was not created or inspected.

## Completion

The controller validates report structure and state transitions. A syntactically
valid report can still fail the delivery if its content does not meet the gate.
