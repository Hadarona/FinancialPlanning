#!/usr/bin/env node
/**
 * End-to-end smoke test against a REALLY RUNNING server (D-SEC-F2, D-DOC-B3).
 *
 * Usage:  npm run smoke            (from the repo root; server must be up)
 *         SMOKE_BASE_URL=http://localhost:4000 npm run smoke
 *
 * Journey: health -> register (unique throwaway email) -> create budget ->
 * add expense -> re-read budget (assert the aggregate moved) -> insights
 * (assert cross-chart coherence) -> delete expense (assert rollback) ->
 * logout (assert the session really ended). Exits non-zero on any failure.
 *
 * The script only ever touches its own throwaway user's data.
 */
import { randomUUID } from "node:crypto";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL.replace(/\/$/, "")}/api/v1`;

const MONTH = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
})();

const EXPENSE_MINOR = 4321;

let cookies = {};
let passed = 0;

function cookieHeader() {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(path, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (init.body) headers["Content-Type"] = "application/json";
  const cookieStr = cookieHeader();
  if (cookieStr) headers.Cookie = cookieStr;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const raw =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const entry of raw) {
    const [pair] = entry.split(";");
    const eq = pair.indexOf("=");
    if (eq !== -1) cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return res;
}

function check(label, condition, detail = "") {
  if (!condition) {
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
    throw new Error(`Smoke check failed: ${label}`);
  }
  passed += 1;
  console.log(`ok    ${label}`);
}

async function main() {
  console.log(`Smoke test against ${API} (month ${MONTH})`);

  // 1. Health
  const health = await request("/health");
  const healthBody = await health.json();
  check("GET /health -> 200 ok", health.status === 200 && healthBody.status === "ok");
  check("health carries X-Request-Id", Boolean(health.headers.get("x-request-id")));

  // 2. Register a throwaway user
  const email = `smoke-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
  const register = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: `Smoke-${randomUUID()}` }),
  });
  check(
    "POST /auth/register -> 201 + session cookie",
    register.status === 201 && cookies.bb_session,
  );

  // 3. Create a budget for the current month
  const createBudget = await request("/budgets", {
    method: "POST",
    body: JSON.stringify({
      month: MONTH,
      incomeMinor: 1250000,
      categories: [
        { id: "housing", plannedMinor: 400000 },
        { id: "groceries", plannedMinor: 150000 },
        { id: "transport", plannedMinor: 80000 },
        { id: "fun", plannedMinor: 90000 },
        { id: "savings", plannedMinor: 300000 },
      ],
    }),
  });
  const created = await createBudget.json();
  check(
    "POST /budgets -> 201",
    createBudget.status === 201,
    JSON.stringify(created.error ?? ""),
  );
  check(
    "budget math: planned 1,020,000 / available 230,000 / actual 0",
    created.budget.plannedMinor === 1020000 &&
      created.budget.availableMinor === 230000 &&
      created.budget.actualMinor === 0,
  );

  // 4. Add an expense
  const addExpense = await request(`/budgets/${MONTH}/transactions`, {
    method: "POST",
    body: JSON.stringify({
      categoryId: "groceries",
      amountMinor: EXPENSE_MINOR,
      occurredOn: `${MONTH}-05`,
      note: "smoke-test expense",
      clientRequestId: randomUUID(),
    }),
  });
  const expense = await addExpense.json();
  check("POST /budgets/:month/transactions -> 201", addExpense.status === 201);

  // 5. Budget aggregate moved by exactly the expense amount
  const afterAdd = await request(`/budgets/${MONTH}`);
  const afterAddBody = await afterAdd.json();
  const groceries = afterAddBody.budget.categories.find((c) => c.id === "groceries");
  check(
    `budget reflects the expense (actual ${EXPENSE_MINOR})`,
    afterAdd.status === 200 &&
      afterAddBody.budget.actualMinor === EXPENSE_MINOR &&
      groceries.actualMinor === EXPENSE_MINOR,
  );

  // 6. Insights coherence: sum of categories == total == last cumulative point
  const insightsRes = await request(`/insights/${MONTH}`);
  const { insights } = await insightsRes.json();
  const categorySum = insights.categories.reduce((sum, c) => sum + c.currentMinor, 0);
  const lastCumulative = insights.cashFlow.currentCumulativeMinor.at(-1);
  check("GET /insights/:month -> 200", insightsRes.status === 200);
  check(
    "insights coherence: category sum == total == last cumulative point",
    categorySum === insights.currentTotalMinor &&
      lastCumulative === insights.currentTotalMinor,
    `sum=${categorySum} total=${insights.currentTotalMinor} cumulative=${lastCumulative}`,
  );
  check(
    "insights total equals the added expense",
    insights.currentTotalMinor === EXPENSE_MINOR,
  );
  const shareSum = insights.categories.reduce((sum, c) => sum + c.sharePercent, 0);
  check("donut shares total exactly 100", shareSum === 100, `got ${shareSum}`);

  // 7. Delete the expense, aggregate rolls back to zero
  const del = await request(`/budgets/${MONTH}/transactions/${expense.transaction.id}`, {
    method: "DELETE",
  });
  check("DELETE /budgets/:month/transactions/:id -> 204", del.status === 204);
  const afterDelete = await request(`/budgets/${MONTH}`);
  const afterDeleteBody = await afterDelete.json();
  check("aggregate rolled back to 0", afterDeleteBody.budget.actualMinor === 0);

  // 8. Logout really ends the session
  const logout = await request("/auth/logout", { method: "POST" });
  check("POST /auth/logout -> 204", logout.status === 204);
  const meAfterLogout = await request("/auth/me");
  check("GET /auth/me after logout -> 401", meAfterLogout.status === 401);

  console.log(`\nSmoke test passed: ${passed} checks against ${API}.`);
}

main().catch((err) => {
  console.error(`\nSmoke test FAILED: ${err.message}`);
  if (err.cause) console.error(String(err.cause));
  process.exitCode = 1;
});
