import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { startTestServer, createCookieJarFetch } from "./helpers/testServer.js";
let ctx;
const send = (client, path, body, method = "POST", headers = {}) =>
  client.request(path, { method, headers, body: JSON.stringify(body) });
async function account() {
  const email = `personal-${randomUUID()}@example.com`,
    client = createCookieJarFetch(ctx.baseUrl);
  const response = await send(client, "/auth/register", {
    email,
    password: "PersonalTest123!",
  });
  expect(response.status).toBe(201);
  const user = (await response.json()).user;
  return { client, email, user };
}
describe("Personal budgeting journeys", () => {
  beforeAll(async () => {
    ctx = await startTestServer({ RATE_LIMIT_AUTH_MAX: 1000, RATE_LIMIT_MAX: 5000 });
  }, 30000);
  afterAll(async () => {
    await ctx?.close();
  });
  it("preserves past plans, allows category editing and protects the one-off category", async () => {
    const { client } = await account();
    let response = await client.request("/months/2026-07");
    const before = (await response.json()).budget;
    expect(before.currencyCode).toBe("ILS");
    expect(before.categories.find((c) => c.id === "one-off").plannedMinor).toBe(0);
    response = await send(
      client,
      "/budget",
      {
        effectiveMonth: "2026-08",
        revision: before.revision,
        incomeMinor: 900000,
        categories: [
          { id: "pets", name: "Pets", plannedMinor: 20000 },
          { id: "one-off", plannedMinor: 10000, archived: true },
        ],
      },
      "PATCH",
    );
    expect(response.status).toBe(200);
    const earlier = (await (await client.request("/months/2026-07")).json()).budget;
    const later = (await (await client.request("/months/2026-09")).json()).budget;
    expect(earlier.incomeMinor).toBe(before.incomeMinor);
    expect(earlier.categories.some((c) => c.id === "pets")).toBe(false);
    expect(later.incomeMinor).toBe(900000);
    expect(later.categories.find((c) => c.id === "pets").plannedMinor).toBe(20000);
    expect(later.categories.find((c) => c.id === "one-off")).toMatchObject({
      plannedMinor: 0,
      archived: false,
    });
    expect(
      (
        await send(
          client,
          "/budget",
          { effectiveMonth: "2026-08", revision: before.revision, incomeMinor: 1 },
          "PATCH",
        )
      ).status,
    ).toBe(409);
    expect((await send(client, "/budget", { incomeMinor: 1 }, "PATCH")).status).toBe(400);
    const insights = (
      await (await client.request("/insights?months=2026-07,2026-09")).json()
    ).insights;
    expect(insights.months.map((m) => m.incomeMinor)).toEqual([
      900000,
      before.incomeMinor,
    ]);
  });
  it("shares with an editor, denies outsiders, and immediately revokes access", async () => {
    const owner = await account(),
      editor = await account(),
      outsider = await account();
    const budgetId = (await (await owner.client.request("/budget")).json()).budget.id,
      headers = { "X-Budget-Id": budgetId };
    const invite = (
      await (
        await send(owner.client, "/sharing/invite", {
          email: editor.email,
          role: "editor",
        })
      ).json()
    ).token;
    expect(
      (await send(outsider.client, "/sharing/accept", { token: invite })).status,
    ).toBe(404);
    expect((await send(editor.client, "/sharing/accept", { token: invite })).status).toBe(
      200,
    );
    expect((await send(editor.client, "/sharing/accept", { token: invite })).status).toBe(
      404,
    );
    expect((await outsider.client.request("/budget", { headers })).status).toBe(404);
    expect(
      (
        await send(
          editor.client,
          "/months/2026-10/transactions",
          { categoryId: "one-off", amountMinor: 1550, occurredOn: "2026-10-01" },
          "POST",
          headers,
        )
      ).status,
    ).toBe(201);
    expect(
      (await (await owner.client.request("/months/2026-10")).json()).budget.actualMinor,
    ).toBe(1550);
    expect(
      (
        await send(
          editor.client,
          "/sharing/invite",
          { email: outsider.email, role: "editor" },
          "POST",
          headers,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await owner.client.request(`/sharing/members/${editor.user.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(204);
    expect((await editor.client.request("/budget", { headers })).status).toBe(404);
  });
  it("viewer access is read-only and sessions can persist for 90 days", async () => {
    const owner = await account(),
      viewer = await account();
    const budgetId = (await (await owner.client.request("/budget")).json()).budget.id,
      headers = { "X-Budget-Id": budgetId };
    const { token } = await (
      await send(owner.client, "/sharing/invite", { email: viewer.email, role: "viewer" })
    ).json();
    await send(viewer.client, "/sharing/accept", { token });
    expect((await viewer.client.request("/budget", { headers })).status).toBe(200);
    expect(
      (
        await send(
          viewer.client,
          "/budget",
          { effectiveMonth: "2026-10", incomeMinor: 1 },
          "PATCH",
          headers,
        )
      ).status,
    ).toBe(403);
    const login = await send(viewer.client, "/auth/login", {
      email: viewer.email,
      password: "PersonalTest123!",
      rememberMe: true,
    });
    expect(login.headers.get("set-cookie")).toContain("Max-Age=7776000");
    expect(
      (
        await send(viewer.client, "/auth/login", {
          email: viewer.email,
          password: "wrong",
        })
      ).status,
    ).toBe(401);
  });
  it("previews Excel without writes, imports atomically and deduplicates retries", async () => {
    const owner = await account(),
      other = await account();
    const w = new ExcelJS.Workbook(),
      sheet = w.addWorksheet("Transactions");
    sheet.addRow(["Date", "Merchant", "Amount", "Currency"]);
    sheet.addRow(["01-08-2026", "Synthetic shop", 12.34, "ILS"]);
    sheet.addRow(["02-08-2026", "Synthetic shop", 3, "ILS"]);
    const bytes = Buffer.from(await w.xlsx.writeBuffer());
    const previewResponse = await owner.client.request("/imports/preview", {
      method: "POST",
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: bytes,
    });
    expect(previewResponse.status).toBe(200);
    const preview = await previewResponse.json();
    expect(preview.rows).toHaveLength(2);
    expect(
      (await (await owner.client.request("/months/2026-08")).json()).budget.actualMinor,
    ).toBe(0);
    const body = {
      previewId: preview.previewId,
      rows: [
        { index: 0, categoryId: "one-off" },
        { index: 1, categoryId: "missing" },
      ],
    };
    expect((await send(owner.client, "/imports/commit", body)).status).toBe(400);
    expect(
      (await (await owner.client.request("/months/2026-08")).json()).budget.actualMinor,
    ).toBe(0);
    body.rows[1].categoryId = "groceries";
    expect((await send(other.client, "/imports/commit", body)).status).toBe(404);
    const imported = await (await send(owner.client, "/imports/commit", body)).json();
    expect(imported).toEqual({ imported: 2, duplicates: 0 });
    expect(await (await send(owner.client, "/imports/commit", body)).json()).toEqual({
      imported: 0,
      duplicates: 2,
    });
    expect(
      (await (await owner.client.request("/months/2026-08")).json()).budget.actualMinor,
    ).toBe(1534);
  });
  it("flags exact manual matches within the selected budget and permits reviewed separate purchases", async () => {
    const owner = await account(),
      other = await account();
    const add = async (client, amountMinor, occurredOn) => {
      const response = await send(client, "/months/2026-08/transactions", {
        categoryId: "groceries",
        amountMinor,
        occurredOn,
        note: "Manually entered lunch",
      });
      expect(response.status).toBe(201);
    };
    await add(owner.client, 1234, "2026-08-01");
    await add(owner.client, 300, "2026-08-02");
    await add(other.client, 700, "2026-08-01");
    const w = new ExcelJS.Workbook(),
      sheet = w.addWorksheet("Transactions");
    sheet.addRow(["Date", "Merchant", "Amount", "Currency"]);
    sheet.addRow(["01-08-2026", "Different description", 12.34, "ILS"]);
    sheet.addRow(["02-08-2026", "Different date", 12.34, "ILS"]);
    sheet.addRow(["01-08-2026", "Different amount", 3, "ILS"]);
    sheet.addRow(["01-08-2026", "Other budget", 7, "ILS"]);
    sheet.addRow(["01-08-2026", "Refund", -12.34, "ILS"]);
    const bytes = Buffer.from(await w.xlsx.writeBuffer());
    const preview = await (
      await owner.client.request("/imports/preview", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: bytes,
      })
    ).json();
    expect(preview.rows.map((r) => r.manualMatches.length)).toEqual([1, 0, 0, 0, 0]);
    expect(preview.rows[0].manualMatches[0].note).toBe("Manually entered lunch");
    const body = {
      previewId: preview.previewId,
      rows: preview.rows.map((r) => ({ index: r.index, categoryId: "one-off" })),
    };
    expect(await (await send(owner.client, "/imports/commit", body)).json()).toEqual({
      imported: 4,
      duplicates: 1,
    });
    expect(
      await (
        await send(owner.client, "/imports/commit", {
          previewId: preview.previewId,
          rows: [{ index: 0, categoryId: "one-off", allowManualMatch: true }],
        })
      ).json(),
    ).toEqual({ imported: 1, duplicates: 0 });
    expect(
      await (
        await send(owner.client, "/imports/commit", {
          previewId: preview.previewId,
          rows: [{ index: 0, categoryId: "one-off", allowManualMatch: true }],
        })
      ).json(),
    ).toEqual({ imported: 0, duplicates: 1 });
  });
  it("rechecks manual matches added after preview, including shared-budget entries", async () => {
    const owner = await account(),
      editor = await account();
    const budgetId = (await (await owner.client.request("/budget")).json()).budget.id;
    const headers = { "X-Budget-Id": budgetId };
    const { token } = await (
      await send(owner.client, "/sharing/invite", { email: editor.email, role: "editor" })
    ).json();
    await send(editor.client, "/sharing/accept", { token });
    const w = new ExcelJS.Workbook(),
      sheet = w.addWorksheet("Transactions");
    sheet.addRow(["Date", "Merchant", "Amount", "Currency"]);
    sheet.addRow(["01-08-2026", "Shop", 12.34, "ILS"]);
    const bytes = Buffer.from(await w.xlsx.writeBuffer());
    const preview = await (
      await editor.client.request("/imports/preview", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: bytes,
      })
    ).json();
    expect(preview.rows[0].manualMatches).toEqual([]);
    expect(
      (
        await send(owner.client, "/months/2026-08/transactions", {
          categoryId: "groceries",
          amountMinor: 1234,
          occurredOn: "2026-08-01",
        })
      ).status,
    ).toBe(201);
    expect(
      await (
        await send(
          editor.client,
          "/imports/commit",
          {
            previewId: preview.previewId,
            rows: [{ index: 0, categoryId: "one-off", allowManualMatch: true }],
          },
          "POST",
          headers,
        )
      ).json(),
    ).toEqual({ imported: 0, duplicates: 1 });
    const refreshed = await (
      await editor.client.request("/imports/preview", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: bytes,
      })
    ).json();
    expect(refreshed.rows[0].manualMatches).toHaveLength(1);
    expect(
      (await (await owner.client.request("/months/2026-08")).json()).budget.actualMinor,
    ).toBe(1234);
  });
  it("keeps future category expenses visible when a scheduled plan is replaced", async () => {
    const { client } = await account();
    expect(
      (
        await send(
          client,
          "/budget",
          {
            effectiveMonth: "2026-09",
            categories: [{ id: "trips", name: "Trips", plannedMinor: 50000 }],
          },
          "PATCH",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await send(client, "/months/2026-09/transactions", {
          categoryId: "trips",
          amountMinor: 1234,
          occurredOn: "2026-09-02",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await send(
          client,
          "/budget",
          { effectiveMonth: "2026-08", incomeMinor: 800000 },
          "PATCH",
        )
      ).status,
    ).toBe(200);
    const budget = (await (await client.request("/months/2026-09")).json()).budget;
    expect(budget.categories.find((c) => c.id === "trips")).toMatchObject({
      archived: true,
      plannedMinor: 0,
      actualMinor: 1234,
    });
    expect(budget.actualMinor).toBe(1234);
    const insights = (await (await client.request("/insights?months=2026-09")).json())
      .insights;
    expect(insights.combinedTotalMinor).toBe(1234);
  });
});
