#!/usr/bin/env node
/**
 * End-to-end smoke test against a REALLY RUNNING server (D-SEC-F2, D-DOC-B3).
 *
 * Usage:  npm run smoke            (from the repo root; server must be up)
 *         SMOKE_BASE_URL=http://localhost:4000 npm run smoke
 *
 * CR-001 journey: health -> register (unique throwaway email; the default
 * budget is auto-provisioned) -> read the single budget -> patch income ->
 * add an expense in a new category -> re-read the month (assert the
 * aggregate moved) -> multi-month insights (assert cross-chart coherence)
 * -> delete expense (assert rollback) -> logout (assert the session really
 * ended). Exits non-zero on any failure.
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

  // 3. The default budget was auto-provisioned at registration (CR1-9)
  const getBudget = await request("/budget");
  const created = await getBudget.json();
  check(
    "GET /budget -> 200 (auto-provisioned)",
    getBudget.status === 200,
    JSON.stringify(created.error ?? ""),
  );
  check(
    "budget math: seven plans totalling 1,200,000 / available 50,000",
    created.budget.plannedMinor === 1200000 &&
      created.budget.availableMinor === 50000 &&
      created.budget.categories.length === 7,
  );

  // 4. Patch income in place (the CR1-5 popup path)
  const patchBudget = await request("/budget", {
    method: "PATCH",
    body: JSON.stringify({ incomeMinor: 1300000 }),
  });
  const patched = await patchBudget.json();
  check(
    "PATCH /budget -> 200, available recomputed to 100,000",
    patchBudget.status === 200 && patched.budget.availableMinor === 100000,
  );

  // 5. Add an expense in one of the new categories (CR2)
  const addExpense = await request(`/months/${MONTH}/transactions`, {
    method: "POST",
    body: JSON.stringify({
      categoryId: "subscriptions",
      amountMinor: EXPENSE_MINOR,
      occurredOn: `${MONTH}-05`,
      note: "smoke-test expense",
      clientRequestId: randomUUID(),
    }),
  });
  const expense = await addExpense.json();
  check("POST /months/:month/transactions -> 201", addExpense.status === 201);

  // 6. Month aggregate moved by exactly the expense amount
  const afterAdd = await request(`/months/${MONTH}`);
  const afterAddBody = await afterAdd.json();
  const subscriptions = afterAddBody.budget.categories.find(
    (c) => c.id === "subscriptions",
  );
  check(
    `month reflects the expense (actual ${EXPENSE_MINOR})`,
    afterAdd.status === 200 &&
      afterAddBody.budget.actualMinor === EXPENSE_MINOR &&
      subscriptions.actualMinor === EXPENSE_MINOR,
  );

  // 7. Multi-month insights coherence per month (CR3)
  const prevMonth = (() => {
    const [y, m] = MONTH.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  })();
  const insightsRes = await request(`/insights?months=${MONTH},${prevMonth}`);
  const { insights } = await insightsRes.json();
  check("GET /insights?months=cur,prev -> 200", insightsRes.status === 200);
  check(
    "insights months normalized newest-first",
    insights.months.length === 2 && insights.months[0].month === MONTH,
  );
  const currentEntry = insights.months[0];
  const categorySum = insights.categories.reduce((sum, c) => sum + c.totalsMinor[0], 0);
  const lastCumulative = currentEntry.cashFlow.cumulativeMinor.at(-1);
  check(
    "insights coherence: category sum == month total == last cumulative point",
    categorySum === currentEntry.totalMinor && lastCumulative === currentEntry.totalMinor,
    `sum=${categorySum} total=${currentEntry.totalMinor} cumulative=${lastCumulative}`,
  );
  check(
    "insights current-month total equals the added expense",
    currentEntry.totalMinor === EXPENSE_MINOR,
  );
  const shareSum = insights.categories.reduce((sum, c) => sum + c.sharePercent, 0);
  check("donut shares total exactly 100", shareSum === 100, `got ${shareSum}`);

  // 8. Delete the expense, aggregate rolls back to zero
  const del = await request(`/months/${MONTH}/transactions/${expense.transaction.id}`, {
    method: "DELETE",
  });
  check("DELETE /months/:month/transactions/:id -> 204", del.status === 204);
  const afterDelete = await request(`/months/${MONTH}`);
  const afterDeleteBody = await afterDelete.json();
  check("aggregate rolled back to 0", afterDeleteBody.budget.actualMinor === 0);

  // 9. Logout really ends the session
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
