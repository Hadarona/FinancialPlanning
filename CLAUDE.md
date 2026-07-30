# Budgeting App Agent Workflow

## Mission

Build the budgeting app through Sprint 0, then Sprints 1–8 in the exact order
defined by `docs/product/Budgeting_App_Development_Roadmap.md`.

The product stack is React, Node.js/Express, and PostgreSQL (hosted on Neon). Every sprint must
produce integrated, testable behavior and auditable evidence.

## Required sources

Read `docs/workflow/source-of-truth.md` before product decisions. Never invent a
requirement when the sources disagree or are incomplete.

Core invariants:

- Store money as integer minor units.
- Keep planned allocations distinct from actual spending.
- Enforce authenticated ownership on every private read and mutation.
- Use the design kit's content, tokens, and responsive rules.
- Treat the six files in `docs/design/approved/` as the approved visual
  compositions.
- Satisfy mandatory course requirements before bonus work.

## Agent roles

Use exactly these three project subagents, defined in `.claude/agents/` and
spawned with the Agent tool (`subagent_type` set to the agent name):

- `developer`: plans, implements, self-tests, and fixes product work.
- `qa-engineer`: plans functional coverage, writes/runs tests, repairs test
  issues, and reports product issues. It never edits product code.
- `design-reviewer`: compares the running UI with approved sources and reports
  mismatches. It never edits product code.

The primary agent is the orchestrator, not a fourth implementation role. It
owns state transitions, phase prompts, report validation, issue routing, and
user checkpoints.

Every role must invoke its matching project skill (in `.claude/skills/`):

- developer → `budget-app-developer-loop`
- QA → `budget-app-qa-loop`
- design reviewer → `budget-app-design-review`

## Model routing

Do not pin a model inside the subagent files. Spawn a fresh role instance for
each phase, passing the model through the Agent tool's `model` parameter with
the following routing:

| Phase | Model |
| --- | --- |
| Developer plan/fix plan | `fable` |
| Developer build | `sonnet` |
| Developer self-test | `sonnet` |
| QA plan | `fable` |
| QA test build | `sonnet` |
| QA run/triage/test repair | `sonnet` |
| Design review | `fable` |

Escalate a `sonnet` phase to `fable` only after recording concrete evidence
that the assigned model cannot resolve an ambiguity. Never escalate merely
because a test failed.

## Sprint state machine

Use `node tools/workflow.mjs` for state changes. Do not hand-edit
`.workflow/state.json`.

For each sprint:

1. Run `start-iteration`.
2. Run the developer Plan → Build → Test loop.
3. If developer self-testing finds issues, repeat its loop inside the same
   outer iteration until it passes or is blocked.
4. After the developer report passes, run QA and design review. They may run in
   parallel because their write areas are disjoint.
5. QA repeats Plan → Build → Run for test issues until its final test-issue
   list is empty.
6. Run `evaluate`.
7. If QA reports product bugs or design reports issues, begin the next outer
   iteration with a developer fix plan that addresses every issue ID.
8. End the sprint automatically only when developer checks pass, QA has no test
   or product issues and every planned test passed, and design has no issues.

The initial outer-iteration limit is five. At the limit, stop all sprint work
and wait for the user.

## User checkpoint

At an `awaiting_user_feedback` state:

- `good enough` accepts the current behavior and UI as the new baseline for
  this sprint, stores every open deviation, ends this sprint loop, and advances
  to the next roadmap sprint unless the user explicitly stops the project.
- `continue` adds exactly five outer iterations. Preserve the user's wording
  verbatim and route it only to the roles they addressed.
- If the user does not identify a role and the feedback cannot be routed
  safely, ask one concise clarification before continuing.

Previously accepted deviations are not defects in later sprints unless the user
reopens them or a later change regresses beyond the accepted baseline.

## File ownership

| Area | Developer | QA | Design reviewer |
| --- | :---: | :---: | :---: |
| Product source/config | write | read only | read only |
| Developer-owned tests | write | read | read |
| Independent QA tests/fixtures | read; write only when explicitly assigned a QA test fix | write | read |
| UI screenshots/diff evidence | read/write for self-test | read | write |
| Role report directory | own only | own only | own only |
| Product/design/roadmap sources | read only | read only | read only |
| `.workflow/state.json` | no | no | no |

Only the orchestrator changes workflow state through the controller.

## Delivery rules

- Preserve unrelated user changes and avoid concurrent product-code writers.
- Use a focused feature or bug-fix branch; never develop directly on `main`.
- Keep plans detailed enough for the conserving build model to execute without
  rediscovering architecture.
- Use real HTTP tests for API integration, not direct controller-only calls.
- Run relevant unit tests, integration tests, lint, coverage, and production
  build as the sprint requires.
- Treat skipped, flaky, false-positive, or unexecuted tests as broken.
- Never alter a correct test expectation to hide a product bug.
- Log every server request externally without passwords, tokens, cookies,
  notes, or full financial bodies.
- Update dependency licenses in the same change as any dependency addition.
- Record evidence under `.workflow/sprints/<sprint>/iteration-NN/`.
- Summaries must cite report and evidence paths instead of pasting raw logs into
  the primary thread.

## Useful commands

```bash
npm run workflow:validate
npm run workflow:status
npm run workflow:start
npm run workflow:evaluate
npm run test:workflow
```

Run `npm run workflow:init` only if `.workflow/state.json` does not exist.
