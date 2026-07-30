# Demo Script — Budgeting App

Rehearsed presentation path (~5 minutes): Register → Budget → Add Expense →
Insights → Comparison → Logout. No devtools, no manual DB edits — everything
runs through the UI (D-DOC-F4).

## Before the demo (once)

```bash
npm run migrate                          # idempotent
ALLOW_DEMO_SEED=true npm run seed:demo   # deterministic demo data (guarded)
npm run build                            # production client
SERVE_CLIENT=true npm run start -w server
```

Open `http://localhost:4000` in a **clean browser profile/incognito window**
(D-DOC-F1). Alternatively run `npm run dev` and use `http://localhost:5173`.

Seeded demo account (created only by the guarded seed, never in production):
`demo@example.com` / `DemoPass123!` — has the current and previous months
populated with the design kit's reference numbers (current total spending
842,000 minor units = `8,420`; previous 918,000 = `9,180`).

## The walk

1. **Register (fresh user).** From the Login screen choose "Create account".
   Register with a throwaway email (e.g. `demo-day@example.com`) and an
   8+ character password. You land on the Budget screen with an empty state —
   "No budget for July yet".
   - _Point out:_ show/hide password toggle, visible labels, inline
     validation (try a short password first, if time allows).
2. **Create the budget.** Click "Create budget". Enter income `12,500` and
   keep the prefilled plans (they total `10,200`). Watch the live footer:
   "Planned 10,200 · Available 2,300" updates per keystroke.
   - _Fallback:_ mistype and the field errors keep your input; the
     unsaved-changes guard fires if you try to navigate away.
3. **Add an expense.** On the Budget screen press "Add expense". Amount
   `42.50`, category Groceries, today's date, note "Team lunch". Save.
   - _Point out:_ the dialog closes, the Groceries row's actual/progress and
     the monthly totals update instantly — no reload; the new entry tops the
     "Recent expenses" history.
4. **Delete it (optional beat).** Press the delete button on the new entry —
   the confirmation names the exact transaction. Confirm, and the totals
   roll back.
5. **Insights.** Open the menu → "View insights". As the fresh user you see
   the honest "no comparison data" state — no fake zero-change claims.
6. **Comparison (seeded account).** Log out, sign in as `demo@example.com`.
   Insights now shows the full comparison: hero total `8,420` "vs 9,180 last
   month", grouped bars (current solid blue, previous patterned yellow),
   donut shares totaling exactly 100%, and the cumulative cash-flow line
   (previous month dashed). Switch the month tabs (arrow keys work) — title,
   totals, all three charts, legend, and text summaries change together.
7. **Logout.** Menu → Log out. You return to the Login screen; pressing Back
   does not expose any private data.

## Fallbacks and recovery notes

- **Server not reachable during the walk:** the app shows a retry error
  state inside the authenticated shell — restart the server and press Retry;
  nothing is lost.
- **Session expiry demo (optional):** delete the `bb_session` cookie while
  on Budget; the next action redirects to Login with "Your session expired —
  please sign in again."
- **Seed data missing:** re-run `ALLOW_DEMO_SEED=true npm run seed:demo`
  (idempotent; recreates only `demo@example.com`'s data).
- **Duplicate month conflict:** if you try to create a month that exists,
  the form offers a direct link to the existing month.
- **Everything is keyboard-operable** — if the mouse dies, Tab/Enter/arrows
  complete the entire walk (dialogs trap focus; month tabs use arrow keys).

## One-command health check before going on stage

```bash
npm run smoke   # 15 end-to-end checks against the running server, exit 0
```
