// Insights verify independently summed expenses and historical monthly plans.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startQaServer } from "../helpers/qaServer.js";
import { createSession, registerUser, mustJson } from "../helpers/qaClient.js";
let ctx;
async function user() {
  const s = createSession(ctx.baseUrl);
  await registerUser(s);
  return s;
}
describe("QA: monthly insights", () => {
  beforeAll(async () => {
    ctx = await startQaServer({ RATE_LIMIT_AUTH_MAX: 1000 });
  }, 30000);
  afterAll(async () => ctx?.close());
  it("reconciles categories, daily totals and monthly plans across three months", async () => {
    const s = await user();
    await s.request("/budget", {
      method: "PATCH",
      body: { effectiveMonth: "2026-08", incomeMinor: 2000000 },
    });
    for (const month of ["2026-07", "2026-08"])
      for (const [categoryId, amountMinor, day] of [
        ["housing", 111, 1],
        ["groceries", 222, 15],
        ["one-off", 333, 31],
      ])
        await mustJson(
          await s.request(`/months/${month}/transactions`, {
            method: "POST",
            body: {
              categoryId,
              amountMinor,
              occurredOn: `${month}-${String(day).padStart(2, "0")}`,
            },
          }),
          201,
        );
    const { insights } = await mustJson(
      await s.request("/insights?months=2026-07,2026-08,2026-09"),
      200,
    );
    expect(insights.months.map((m) => m.month)).toEqual([
      "2026-09",
      "2026-08",
      "2026-07",
    ]);
    expect(insights.months.map((m) => m.totalMinor)).toEqual([0, 666, 666]);
    expect(insights.months.map((m) => m.incomeMinor)).toEqual([
      2000000, 2000000, 1250000,
    ]);
    expect(insights.combinedTotalMinor).toBe(1332);
    for (let i = 0; i < 3; i++)
      expect(insights.categories.reduce((n, c) => n + c.totalsMinor[i], 0)).toBe(
        insights.months[i].cashFlow.cumulativeMinor.at(-1),
      );
    expect(insights.categories.reduce((n, c) => n + c.sharePercent, 0)).toBe(100);
  });
  it.each(["", "2026-07,2026-07", "2026-01,2026-02,2026-03,2026-04", "2026-13", "bad"])(
    "rejects invalid selection %s",
    async (value) => {
      const s = await user();
      expect((await s.request(`/insights?months=${value}`)).status).toBe(400);
    },
  );
  it("empty months have zero actuals and zero shares", async () => {
    const s = await user();
    const { insights } = await mustJson(await s.request("/insights?months=2024-02"), 200);
    expect(insights.combinedTotalMinor).toBe(0);
    expect(insights.categories.every((c) => c.sharePercent === 0)).toBe(true);
    expect(insights.months[0].cashFlow.labels.at(-1)).toBe("Feb 29");
  });
  it("never includes another account’s transactions", async () => {
    const a = await user(),
      b = await user();
    await a.request("/months/2026-07/transactions", {
      method: "POST",
      body: { categoryId: "housing", amountMinor: 500, occurredOn: "2026-07-01" },
    });
    const { insights } = await mustJson(await b.request("/insights?months=2026-07"), 200);
    expect(insights.combinedTotalMinor).toBe(0);
  });
});
