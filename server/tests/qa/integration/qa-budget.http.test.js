// Current contract: one recurring budget with dated, editable category plans.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startQaServer } from "../helpers/qaServer.js";
import { createSession, registerUser, mustJson } from "../helpers/qaClient.js";
let ctx;
async function user() {
  const s = createSession(ctx.baseUrl);
  await registerUser(s);
  return s;
}
const get = (s, m) => s.request(`/months/${m}`).then((r) => mustJson(r, 200));
const patch = (s, body) => s.request("/budget", { method: "PATCH", body });
describe("QA: dated permanent budget", () => {
  beforeAll(async () => {
    ctx = await startQaServer({ RATE_LIMIT_AUTH_MAX: 1000 });
  }, 30000);
  afterAll(async () => ctx?.close());
  it("registration provisions ILS and every calendar month without a create step", async () => {
    const s = await user();
    for (const month of ["2020-01", "2026-07", "2035-12"]) {
      const { budget } = await get(s, month);
      expect(budget.currencyCode).toBe("ILS");
      expect(budget.categories).toHaveLength(8);
      expect(budget.plannedMinor).toBe(1200000);
      expect(budget.availableMinor).toBe(50000);
      expect(budget.actualMinor).toBe(0);
    }
  });
  it.each(["2026-13", "202607", "2026-00", "bad"])(
    "rejects malformed month %s",
    async (month) => {
      expect((await (await user()).request(`/months/${month}`)).status).toBe(400);
    },
  );
  it("merges plans and preserves earlier months", async () => {
    const s = await user();
    await mustJson(
      await patch(s, { effectiveMonth: "2026-07", incomeMinor: 2000000 }),
      200,
    );
    await mustJson(
      await patch(s, {
        effectiveMonth: "2026-08",
        categories: [{ id: "housing", plannedMinor: 500000 }],
      }),
      200,
    );
    expect((await get(s, "2026-06")).budget.incomeMinor).toBe(1250000);
    expect((await get(s, "2026-07")).budget.plannedMinor).toBe(1200000);
    expect((await get(s, "2026-08")).budget.plannedMinor).toBe(1300000);
    expect((await get(s, "2026-08")).budget.incomeMinor).toBe(2000000);
  });
  it("changes from a selected month replace later scheduled plans", async () => {
    const s = await user();
    await patch(s, { effectiveMonth: "2027-01", incomeMinor: 300 });
    await patch(s, { effectiveMonth: "2026-08", incomeMinor: 200 });
    expect((await get(s, "2027-01")).budget.incomeMinor).toBe(200);
    expect((await get(s, "2026-07")).budget.incomeMinor).toBe(1250000);
  });
  it("supports adding, renaming and archiving categories without losing expenses", async () => {
    const s = await user();
    await mustJson(
      await patch(s, {
        effectiveMonth: "2026-07",
        categories: [{ id: "pets", name: "Pets", plannedMinor: 1000 }],
      }),
      200,
    );
    await mustJson(
      await s.request("/months/2026-07/transactions", {
        method: "POST",
        body: { categoryId: "pets", amountMinor: 2000, occurredOn: "2026-07-01" },
      }),
      201,
    );
    await mustJson(
      await patch(s, {
        effectiveMonth: "2026-07",
        categories: [
          { id: "pets", name: "Pet care", plannedMinor: 1000, archived: true },
        ],
      }),
      200,
    );
    expect(
      (await get(s, "2026-07")).budget.categories.find((c) => c.id === "pets"),
    ).toMatchObject({
      name: "Pet care",
      archived: true,
      actualMinor: 2000,
      state: "overspent",
    });
    expect(
      (
        await s.request("/months/2026-07/transactions", {
          method: "POST",
          body: { categoryId: "pets", amountMinor: 1, occurredOn: "2026-07-01" },
        })
      ).status,
    ).toBe(400);
  });
  it.each([
    {},
    { incomeMinor: -1 },
    { incomeMinor: 1.5 },
    { categories: [{ id: "housing", plannedMinor: -1 }] },
    {
      categories: [
        { id: "housing", plannedMinor: 1 },
        { id: "housing", plannedMinor: 2 },
      ],
    },
    { currencyCode: "USD" },
  ])("rejects invalid plan edits without mutation: %j", async (body) => {
    const s = await user(),
      before = await get(s, "2026-07");
    expect((await patch(s, { effectiveMonth: "2026-07", ...body })).status).toBe(400);
    expect(await get(s, "2026-07")).toEqual(before);
  });
  it("arbitrates stale simultaneous edits with a revision conflict", async () => {
    const s = await user();
    const revision = (await get(s, "2026-07")).budget.revision;
    const results = await Promise.all(
      [100, 200].map((incomeMinor) =>
        patch(s, { effectiveMonth: "2026-07", incomeMinor, revision }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it("zero planned spending has no division by zero and over-allocation is allowed", async () => {
    const s = await user();
    await patch(s, { effectiveMonth: "2026-07", incomeMinor: 0 });
    await s.request("/months/2026-07/transactions", {
      method: "POST",
      body: { categoryId: "one-off", amountMinor: 100, occurredOn: "2026-07-01" },
    });
    const { budget } = await get(s, "2026-07");
    expect(budget.availableMinor).toBe(-1200000);
    expect(budget.categories.find((c) => c.id === "one-off")).toMatchObject({
      plannedMinor: 0,
      actualMinor: 100,
      progressPercent: null,
      state: "unplanned",
    });
  });
});
