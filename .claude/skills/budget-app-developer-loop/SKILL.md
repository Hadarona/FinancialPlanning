---
name: budget-app-developer-loop
description: Execute the developer phase of the budgeting-app sprint workflow, including implementation planning, planned code changes, developer testing, and fix cycles driven by developer, QA, or design findings. Use for any sprint feature, bug fix, or design correction in the React, Node.js/Express, and Neon-hosted PostgreSQL budgeting-app repository governed by its workflow files.
---

# Budget App Developer Loop

Operate only inside the current sprint and assigned phase. Let the parent
orchestrator choose the model and reasoning effort for each phase.

## Establish context

1. Read the repository `CLAUDE.md`.
2. Read `docs/workflow/source-of-truth.md`,
   `docs/workflow/artifact-contract.md`, and `.workflow/state.json`.
3. Read only the current sprint section in
   `docs/product/Budgeting_App_Development_Roadmap.md`, plus any linked product
   or design source needed for the assigned work.
4. Read the latest developer self-test findings, final QA product-issue report,
   final design report, and feedback addressed to `developer`.
5. Stop and report a blocker if the sprint, iteration, sources, or required
   handoff is missing or contradictory. Do not guess product behavior.

Preserve unrelated changes. Never weaken tests, acceptance criteria, security,
logging, or accessibility merely to obtain a passing result.

## Plan

Create the iteration's `developer/plan.md` before editing product code. Make it
detailed enough for a smaller implementation model to follow mechanically.
Include:

- sprint goal, in-scope acceptance criteria, and explicit non-goals;
- current behavior and evidence;
- every QA, design, and developer issue being handled;
- ordered tasks with exact files/symbols, data flow, API/schema impact, and
  dependencies;
- validation and rollback-safe checkpoints;
- test cases, commands, expected results, and design viewports;
- risks, assumptions, and unresolved decisions.

For a fix plan, map every reported issue ID to one or more tasks. Do not silently
drop low-severity findings. Mark a finding `disputed` only with reproducible
evidence for the reviewer.

## Build

1. Implement the approved plan in order.
2. Keep each change scoped and preserve existing user work.
3. Follow the roadmap's architecture, money/date rules, ownership filtering,
   logging/redaction rules, and design tokens.
4. Add or update the developer-owned unit/component tests needed for changed
   logic. Do not rewrite independent QA tests to conceal a product defect.
5. Record any necessary plan deviation in `developer/build-report.md` with its
   reason, affected files, and validation impact.
6. Run targeted checks after each coherent change instead of waiting until the
   end.

## Test

Test the implemented behavior, not merely the code path.

1. Run formatting/lint, relevant unit and component tests, relevant real-HTTP
   integration tests, and the production build when those commands exist.
2. Exercise the real changed journey and error states. For UI work, inspect the
   affected reference viewports and browser console.
3. Reconcile financial values and chart outputs against the roadmap invariants.
4. Record commands, exit codes, assertions, evidence, acceptance checks, and
   open issues in `developer/test-report.json` using the repository template.
5. Treat skipped, flaky, false-positive, or unexecuted checks as failures unless
   the roadmap explicitly excludes them.

Set the final developer report to `pass` only when every in-scope acceptance
check passes and `openIssues` is empty.

## Fix cycle

When self-testing finds an issue, repeat Plan → Build → Test inside the same
developer phase using a numbered `cycle-NN` subdirectory. Continue until the
developer report passes or a real blocker requires user input. On the next
sprint iteration, treat QA product issues and design issues as mandatory plan
inputs and repeat the same loop.

## Handoff

Return a concise summary containing:

- implemented scope and changed files;
- checks run and their results;
- issue IDs resolved, disputed, or blocked;
- exact report paths;
- remaining risk.

Do not claim sprint acceptance. QA, design review, and the orchestrator own the
final gate.
