---
name: budget-app-qa-loop
description: Execute the functional QA phase of the budgeting-app delivery workflow by planning coverage, building independent tests, running and verifying them, classifying failures as test or product issues, repairing broken tests, and producing final evidence. Use after the developer phase of the delivery or any rerun.
---

# Budget App QA Loop

Test functionality only. Do not review visual styling and do not modify product
implementation. Let the parent orchestrator choose the model and reasoning
effort for each phase.

## Establish context

1. Read the repository `CLAUDE.md`.
2. Read `docs/workflow/source-of-truth.md`,
   `docs/workflow/artifact-contract.md`, `.workflow/state.json`, and the entire
   roadmap (the full scope contract for the single delivery).
3. Read the developer plan, build report, and final developer test report.
4. Read feedback addressed to `qa`.
5. Inspect the real implementation and existing tests. Do not trust a developer
   summary without evidence.

Stop if the developer report is not passing, the app cannot be started from
documented commands, or the delivery contract is missing.

## Plan coverage

Create `qa/plan.md` before writing tests. Trace every in-scope functional
acceptance criterion to one or more test cases. Cover:

- success, validation, boundary, empty, error, retry, and authorization paths;
- pure calculations and financial invariants;
- React behavior and user-visible state changes;
- services/repositories and PostgreSQL constraints;
- real HTTP behavior through an actual listening Express server;
- affected regression journeys and cross-user privacy;
- required coverage evidence without using percentage as a substitute for
  critical-path tests.

Specify setup, fixtures, steps, assertions, layer, command, expected result, and
the defect that each test would detect. Keep aesthetics out of the plan.

## Build independent tests

1. Add or change test code, fixtures, and test-only harness configuration.
2. Do not edit application source, production configuration, or acceptance
   criteria.
3. Use observable public behavior where practical. Avoid assertions that only
   mirror implementation details.
4. Make test data isolated, deterministic, ownership-aware, and safe across
   reruns.
5. Prove new tests can fail for the intended reason when feasible, then restore
   the real implementation before the final run.

## Run and verify

For every planned test:

1. Run it and retain the command, exit code, and relevant evidence.
2. Verify that setup, action, and assertions actually executed. A green test
   that skipped the intended steps, asserted the wrong value, or swallowed an
   error is a **test issue**, not a pass.
3. For each failure, reproduce and classify it:
   - `test_issue`: wrong expectation, broken fixture/harness, flakiness,
     environment leak, or a test that did not exercise its target;
   - `product_issue`: implementation violates the authoritative behavior;
   - `blocked`: missing dependency or environment prevents classification.
4. Put test issues in the working test-issue report. Put product issues in the
   detailed product-issue report with severity, exact reproduction, expected
   and actual behavior, evidence, affected acceptance IDs, and likely owning
   area.

Never convert a product issue into a test expectation merely to make the suite
green.

## Repair test issues

If any test issue exists, repeat Plan → Build → Run for the affected tests.
Re-run relevant neighboring tests after each repair. Continue until the final
`qa/run-report.json` has an empty `testIssues` array or a genuine blocker is
reported. Keep previous cycles under numbered `qa/cycle-NN` directories so the
evidence is auditable.

## Final QA gate

Use the repository template for `qa/run-report.json`.

The QA phase is internally accepted only when:

- no broken, flaky, skipped-without-approval, or false-positive test remains;
- `testIssues` is empty;
- every planned test is `passed` or is linked to a detailed `product_bug`;
- all failures are classified with evidence;
- coverage and required commands are recorded.

Product bugs may remain in the QA report, but they fail the delivery gate and
must return to the developer on the next delivery iteration. QA never marks
the delivery complete.
