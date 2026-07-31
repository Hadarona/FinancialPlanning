# Source of Truth

Use all sources, but resolve conflicts in this order.

## 1. Explicit user decisions

The user's newest delivery feedback is authoritative for the scope it addresses.
Feedback must be stored verbatim and routed only to the named roles.

An explicit `good enough` decision creates an accepted baseline. Its recorded
differences remain correct until the user reopens them or later work regresses
beyond that baseline.

## 2. Mandatory project requirements

`docs/product/Project_requirements_English.md` defines mandatory course gates
and bonus targets. A roadmap item cannot waive a mandatory requirement.

Mandatory work precedes bonus work. Authentication is treated as MVP because
the approved product contains accounts and private financial data, even though
the course labels authentication as a bonus.

## 3. Product roadmap

`docs/product/Budgeting_App_Development_Roadmap.md` defines:

- the full product scope; its sprint sections are the scope checklist and a
  recommended build order inside the single delivery, not separate cycles;
- product scope and explicit non-goals;
- data model and REST direction;
- calculation, ownership, money, date, security, logging, and test rules;
- per-section design, frontend, backend, and QA acceptance criteria;
- release and evidence gates.

Use the roadmap—not visual approximations—to resolve functional meaning. In
particular:

- planned allocations total `10,200`;
- actual July activity totals `8,420`;
- category progress is actual spending divided by planned allocation;
- planned and actual values are not interchangeable.

## 4. Structured design kit

Within `docs/design/figma-kit`, follow the kit's own order:

1. `data/content.json`
2. `tokens/`
3. `docs/`
4. `references/`

Structured content controls exact copy and coherent example numbers. Tokens
control exact colors, typography, spacing, radius, effects, and responsive
values. Specifications control components, states, layouts, accessibility, and
responsive behavior.

## 5. Approved screenshots

The six files in `docs/design/approved/` are the approved compositions:

- desktop and mobile Login;
- desktop and mobile Budget;
- desktop and mobile Insights.

Use them for visual hierarchy, composition, relative sizing, and overall
appearance. The outer browser/phone frame and the page label outside that frame
are presentation context, not application UI. Compare the implementation
viewport with the screen content inside the frame.

When a generated screenshot has a small copy, number, color, spacing, or icon
inconsistency, the structured kit value wins.

## 6. Current implementation

Source code and existing tests describe what the product currently does; they
do not override required behavior. They become authoritative only to the
extent captured in an accepted baseline.

## Conflict protocol

When two same-priority sources still conflict:

1. record the exact conflict and affected acceptance criterion;
2. avoid irreversible or broad implementation;
3. ask the user for the smallest decision needed;
4. store the answer as delivery feedback.

Never silently choose a convenient interpretation.
