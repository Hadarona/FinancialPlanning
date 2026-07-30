---
name: budget-app-design-review
description: Review the budgeting-app frontend for visual and responsive fidelity against the approved mobile/desktop screenshots, Figma-like source kit, roadmap, and accepted user baselines. Use after a developer sprint phase to capture implemented UI, identify every actionable UI mismatch, and produce an evidence-backed design report without editing product code.
---

# Budget App Design Review

Review only; never edit application code, styles, tests, tokens, or design
sources. Let the parent orchestrator choose the model and reasoning effort.

## Establish context

1. Read the repository `CLAUDE.md`.
2. Read `docs/workflow/source-of-truth.md`,
   `docs/design/approved-screens.md`, `docs/workflow/artifact-contract.md`,
   `.workflow/state.json`, and the current sprint section of the roadmap.
3. Read feedback addressed to `design` and any accepted baseline for this
   sprint.
4. Read the developer handoff, then inspect the running UI independently.

Use explicit user feedback and accepted baselines first. Within the design kit,
use `data/content.json`, then `tokens/`, then `docs/`, then reference images.
Use the six approved screenshots for composition and overall appearance; when a
small screenshot inconsistency conflicts with structured kit values, the
structured value wins.

## Capture evidence

1. Start the app with documented commands.
2. Use deterministic demo data matching the relevant source content.
3. Capture each affected screen and state at its reference viewport:
   mobile `390 × 844` and desktop `1440 × 900`.
4. For responsive work, also inspect `320`, `768`, and `1024` px widths, 200%
   text zoom, and reduced-motion behavior where applicable.
5. Save screenshots, browser console evidence, and any visual-diff artifacts
   under the current iteration's `design/evidence/` directory.

If capture is impossible, report `blocked` with the exact missing command,
route, data, or environment. Do not infer a pass from source code alone.

## Review

Check every affected view for:

- content, labels, numbers, ordering, semantic colors, and icons;
- typography, spacing, alignment, grid, dimensions, radii, borders, shadows,
  and visual hierarchy;
- responsive reflow, clipping, overflow, target sizes, and zoom behavior;
- loading, empty, validation, error, disabled, focus, overspending, and
  session-expired states required by the current sprint;
- consistency with reusable tokens and components rather than one-off visual
  approximations;
- regressions on previously accepted screens touched by the change.

Separate visual issues from functional defects. Mention a functional blocker
only to explain why visual review could not be completed; QA owns functional
classification.

## Report

Write `design/review-report.json` using the repository template and a concise
`design/review-report.md`.

For every issue include:

- stable ID, severity, screen/state, and viewport;
- category and affected roadmap/design requirement;
- expected versus actual result;
- reproduction steps;
- evidence path and source reference;
- whether it is new, regressed, or previously accepted.

Do not collapse several independently fixable mismatches into a vague
"pixel-perfect" item. Do not report deliberate differences listed in the
accepted baseline as defects.

Set the report to `pass` only when `issues` is empty. Use `not_applicable` only
when the sprint has no implemented or affected UI and state why. The
orchestrator—not the reviewer—marks a sprint complete.
