# Keyboard & Accessibility Checklist — Stage G (D-RESP-F2/F3/F4/F6, kit checklist)

Status legend: **verified-by-test** (automated component/integration test
asserts it), **verified-by-code-audit** (implementation inspected in this
batch; exact file noted), **deferred-to-self-test** (needs a real browser —
executed in the developer self-test phase per the batch-2 precedent).

## Keyboard operability (D-RESP-F2)

| Check | Status | Evidence |
|---|---|---|
| Login/Register fully keyboard operable, visible focus, logical order | verified-by-test | `client/tests/LoginPage.test.jsx`, `PasswordInput.test.jsx` (toggle keeps focus, `aria-pressed`); focus ring `:focus-visible` in `global.css` |
| Menu opens/closes with keyboard, Escape dismisses | verified-by-test | `client/tests/Menu.test.jsx` |
| Expense dialog: focus moves in, is trapped, Escape closes, focus returns to opener | verified-by-test | `client/tests/AddExpenseDialog.test.jsx`; `components/ui/Dialog.jsx` |
| Delete confirmation operable by keyboard, names the transaction | verified-by-test | `client/tests/DeleteExpenseConfirm.test.jsx` |
| Month tabs: `role=tablist`, roving tabindex, ArrowLeft/ArrowRight/Home/End, selection follows focus (D-RESP-F3) | verified-by-test | `client/tests/InsightsPage.test.jsx` ("switches months from the tabs with arrow keys"); `components/ui/MonthTabs.jsx` |
| Chart data points reachable by Tab with labels + tooltip on focus | verified-by-test | `client/tests/InsightsPage.test.jsx` (`tabindex="0"` marks); `tooltipHandlers` binds `onFocus`/`onBlur` |
| Equivalent data tables for every chart (D-INS-F4) | verified-by-test | `client/tests/InsightsPage.test.jsx` (rowheader/table name assertions) |
| Plan form: unsaved-changes dialog keyboard operable | verified-by-test | `client/tests/BudgetFormPage.test.jsx` |
| Full-page Tab order walk in a real browser | deferred-to-self-test | needs real focus traversal |

## Focus visibility (D-RESP-D4)

- Global `:focus-visible` ring: 2px `--color-focus` (blue-700, 6.94:1 vs
  background) with 2px offset (`global.css`) — verified-by-code-audit.
- SVG chart marks get the same ring via `.chart-mark:focus-visible`
  (`charts.css`) — verified-by-code-audit; unclipped rendering
  deferred-to-self-test (browser paint).
- Month tabs use an inset ring so it cannot be clipped by the pill's
  `overflow: hidden` (`MonthTabs.css`) — verified-by-code-audit.

## Target sizes (D-RESP-D5)

- Icon buttons 44×44 (`IconButton.css`), buttons min-height 48
  (`Button.css`), menu items min-height 44 (`Menu.css`), month tabs
  min-height 44 (`MonthTabs.css`), inputs min-height 48 (`TextInput.css`)
  — verified-by-code-audit.
- Chart focus targets are small marks by nature; the equivalent data table
  and legend provide the accessible alternative (kit checklist's own
  chart provision).

## Live regions / announcements

- Expense added/deleted announced via `role="status"` `aria-live=polite`
  (`BudgetPage.jsx`), month label change announced (`MonthNav.jsx`), form
  errors `role="alert"` associated to inputs via `aria-describedby`
  (`TextInput.jsx`, `PasswordInput.jsx`), plan totals `aria-live`
  (`BudgetFormPage.jsx`), session expiry notice `role="status"`
  (`LoginPage.jsx`) — verified-by-test/code-audit.

## Headings

One `h1` per page (AppHeader title or auth-card title); sections and dialog
titles are `h2` (`ExpensePanel`, `Dialog`, insights chart cards, state
panels). Verified-by-code-audit (grep sweep this batch).

## Zoom & reflow (D-RESP-F4)

- No fixed-height text containers; layouts are flex/grid with `min-width:
  0` guards; charts resize via ResizeObserver — verified-by-code-audit.
- 200% zoom journey (Login → Budget → dialog → Insights) —
  deferred-to-self-test (browser).

## Reduced motion (D-RESP-D6/F6)

- All transitions/animations are 160–220 ms and globally disabled under
  `prefers-reduced-motion: reduce` (`global.css` universal override;
  `MonthTabs.css`/`Button.css` wrap their transitions in
  `no-preference`) — verified-by-code-audit; emulation pass
  deferred-to-self-test.

## Color independence

- Overspent/unplanned states: icon + text, never color alone
  (`CategoryRow.jsx`, `client/tests/BudgetPage.test.jsx`).
- July/June series: solid vs dashed line, plain vs patterned bars, labeled
  legends (`charts/`) — verified-by-test (pattern/dash rendered in test DOM).
- Full ratios: see `contrast.md` (same directory).
