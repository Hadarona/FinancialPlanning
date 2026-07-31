# Change Request 001 — Post-delivery product changes (2026-07-31)

Per `docs/workflow/source-of-truth.md` §1, these explicit user decisions are the
highest-priority source and override the roadmap and design kit wherever they
conflict. Delivered via delivery-2 on the same branch/PR.

## User notes (verbatim)

> 1. the budget is not a budget per nonth. we have one budget and then it is
> the same budget every month. the expense adding is per month. the budget
> should be editable by clicking on the relevant part. lets say I want to
> change the income, I will click on the income and there should be a popup
> edit. same with any of the other categories except "planned" and "available"
> those are calculated by all the rest
>
> 2. I want to add a subscriptions, and utilities categories as well.
>
> 3. in the "insights" the default month to present should be the current
> month. but we should be able to select in multi-select dropdown the months
> we want to compare. not more than 3 months at a time

## Structured interpretation

1. **Single recurring budget (CR1-BUDGET)**
   - One budget per user (income + per-category planned amounts), applied
     identically to every month. No more per-month budget rows; the
     `(userId, month)` budget-period model is replaced.
   - Expenses remain recorded per month; monthly progress = that month's actual
     spending vs the single budget's plans.
   - Budget editing is in-place: clicking income opens a popup editor for
     income; clicking a category opens a popup editor for that category's
     planned amount. "Planned" (total) and "Available" are calculated fields
     and are NOT directly editable.
   - The previous separate edit-budget form flow is superseded by click-to-edit
     popups.

2. **Two new categories (CR2-CATEGORIES)**
   - Add "Subscriptions" and "Utilities" to the existing five categories
     (seven total). Icons/colors: choose coherent Lucide icons and kit-ramp
     colors; this is a sanctioned extension of the design kit's five-category
     content (user decision outranks kit).

3. **Insights month comparison (CR3-INSIGHTS)**
   - Default view: the CURRENT calendar month.
   - A multi-select dropdown chooses which months to compare — minimum 1,
     maximum 3 months selected at a time (enforce in UI and API).
   - Charts and summaries must adapt to 1, 2, or 3 selected months; the fixed
     "current + previous" comparison model is superseded.

## Invariants that still hold

Integer minor units; planned vs actual distinct; authenticated ownership on
every private read/mutation; logging redaction; accessibility and responsive
rules; existing quality gates (developer, QA, design) and evidence contract.
