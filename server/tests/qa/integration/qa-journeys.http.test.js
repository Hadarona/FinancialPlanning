import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { startQaServer } from "../helpers/qaServer.js";
import { createSession, registerUser, mustJson } from "../helpers/qaClient.js";
let ctx;
describe("QA: user journeys", () => {
  beforeAll(async () => {
    ctx = await startQaServer({ RATE_LIMIT_AUTH_MAX: 1000 });
  }, 30000);
  afterAll(async () => ctx?.close());
  it("registers, remembers login, adds an expense, retries safely, compares and deletes it", async () => {
    const s = createSession(ctx.baseUrl);
    const { email, password } = await registerUser(s);
    expect((await s.request("/auth/me")).status).toBe(200);
    await s.request("/auth/logout", { method: "POST" });
    expect((await s.request("/auth/me")).status).toBe(401);
    const login = await s.request("/auth/login", {
      method: "POST",
      body: { email, password, rememberMe: true },
    });
    expect(login.headers.get("set-cookie")).toContain("Max-Age=7776000");
    const payload = {
      categoryId: "groceries",
      amountMinor: 1234,
      occurredOn: "2026-07-15",
      clientRequestId: randomUUID(),
    };
    const first = await mustJson(
      await s.request("/months/2026-07/transactions", { method: "POST", body: payload }),
      201,
    );
    const retry = await mustJson(
      await s.request("/months/2026-07/transactions", { method: "POST", body: payload }),
      200,
    );
    expect(retry.transaction.id).toBe(first.transaction.id);
    const read = () => s.request("/months/2026-07").then((r) => mustJson(r, 200));
    expect((await read()).budget.actualMinor).toBe(1234);
    const insight = await mustJson(
      await s.request("/insights?months=2026-07,2026-06"),
      200,
    );
    expect(insight.insights.months.map((m) => m.totalMinor)).toEqual([1234, 0]);
    expect(
      (
        await s.request(`/months/2026-07/transactions/${first.transaction.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(204);
    expect((await read()).budget.actualMinor).toBe(0);
  });
  it("rejects an impossible date and permits a corrected idempotent request", async () => {
    const s = createSession(ctx.baseUrl);
    await registerUser(s);
    const body = {
      categoryId: "one-off",
      amountMinor: 100,
      occurredOn: "2026-02-30",
      clientRequestId: randomUUID(),
    };
    expect(
      (await s.request("/months/2026-02/transactions", { method: "POST", body })).status,
    ).toBe(400);
    body.occurredOn = "2026-02-28";
    expect(
      (await s.request("/months/2026-02/transactions", { method: "POST", body })).status,
    ).toBe(201);
    const list = await mustJson(await s.request("/months/2026-02/transactions"), 200);
    expect(list.total).toBe(1);
  });
});
