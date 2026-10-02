import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
const password = "Test-only-2026!";
async function register(page, email) {
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/budget/);
  await expect(
    page.getByRole("button", { name: "Add expense", exact: true }),
  ).toBeVisible();
}
test("personal budgeting journey: plans, expenses, Excel preview, duplicate protection, insights and Hebrew mobile", async ({
  page,
}, testInfo) => {
  const email = `browser-${Date.now()}@example.test`;
  await register(page, email);
  await page.getByRole("link", { name: "Plan & share" }).click();
  await page.getByLabel("Effective from").fill("2026-07");
  await expect(page.getByLabel("Monthly income (ILS)")).toBeVisible();
  await page.getByLabel("Monthly income (ILS)").fill("15000");
  await page.getByRole("button", { name: "+ Add category", exact: true }).click();
  await page.getByLabel("Category name", { exact: true }).last().fill("Family trips");
  await page.getByLabel("Monthly plan (ILS)", { exact: true }).last().fill("500");
  await page.getByRole("button", { name: "Save from selected month" }).click();
  await expect(page.getByRole("status")).toContainText("Plan saved");
  const old = await page.request.get("/api/v1/months/2026-06");
  expect((await old.json()).budget.incomeMinor).not.toBe(1500000);
  await page.goto("/budget?month=2026-07");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.getByLabel("Amount", { exact: true }).fill("125.50");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Family trips" });
  await page.getByLabel("Date", { exact: true }).fill("2026-07-15");
  await page.getByLabel("Note (optional)", { exact: true }).fill("Family day out");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByText("Family day out", { exact: true })).toBeVisible();
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Transactions");
  sheet.addRow([
    "Purchase date",
    "Merchant",
    "Category",
    "Billed amount",
    "Currency",
    "Billing date",
  ]);
  sheet.addRow(["12/07/2026", "Coffee shop", "Dining", 42.5, "ILS", "10/08/2026"]);
  sheet.addRow(["13/07/2026", "Refund", "Dining", -4.13, "ILS", "10/08/2026"]);
  sheet.addRow([
    "15/07/2026",
    "Day trip from statement",
    "Dining",
    125.5,
    "ILS",
    "10/08/2026",
  ]);
  const buffer = Buffer.from(await book.xlsx.writeBuffer());
  await page.getByRole("link", { name: "Import", exact: true }).click();
  await page.getByLabel("Excel statement (.xlsx, up to 5 MB)").setInputFiles({
    name: "synthetic.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await page.getByRole("button", { name: "Preview transactions" }).click();
  await expect(page.getByRole("heading", { name: "Review & categorize" })).toBeVisible();
  await expect(page.getByText("Possible duplicate", { exact: true })).toBeVisible();
  await expect(page.getByText("Family day out", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Import row 4", { exact: true })).not.toBeChecked();
  await page
    .getByRole("combobox", { name: "Dining", exact: true })
    .selectOption({ label: "Family trips" });
  await page.screenshot({
    path: testInfo.outputPath("import-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByRole("status")).toContainText("Imported 2");
  await page.getByRole("button", { name: "Preview transactions" }).click();
  await expect(page.getByRole("button", { name: "Confirm import" })).toBeDisabled();
  await page.goto("/insights?months=2026-07,2026-08,2026-09");
  await expect(page.getByRole("heading", { name: "Spending insights" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cash flow trend" })).toBeVisible();
  await expect(page.locator(".insights-hero-total").last()).toHaveText("₪163.87");
  await expect(page.locator(".insights-charts .chart-plot > svg")).toHaveCount(3);
  await page.screenshot({
    path: testInfo.outputPath("insights-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByRole("button", { name: "Switch to Hebrew", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".insights-charts .chart-plot > svg")).toHaveCount(3);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("insights-hebrew-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "החודש שלי", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "הוספת הוצאה", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("budget-hebrew-mobile.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "הוספת הוצאה", exact: true }),
  ).toBeVisible();
});
test("shared viewer cannot change a budget, and revoked access stops reads", async ({
  page,
  browser,
}) => {
  const stamp = Date.now(),
    email = `owner-${stamp}@example.test`,
    viewerEmail = `viewer-${stamp}@example.test`;
  await register(page, email);
  const invite = await page.request.post("/api/v1/sharing/invite", {
    data: { email: viewerEmail, role: "viewer" },
  });
  expect(invite.ok()).toBeTruthy();
  const { token } = await invite.json();
  const context = await browser.newContext();
  const viewer = await context.newPage();
  await register(viewer, viewerEmail);
  expect(
    (await viewer.request.post("/api/v1/sharing/accept", { data: { token } })).ok(),
  ).toBeTruthy();
  await viewer.reload();
  await viewer
    .getByRole("combobox", { name: "Budget", exact: true })
    .selectOption({ label: `${email} (view only)` });
  await expect(
    viewer.getByRole("button", { name: "Add expense", exact: true }),
  ).toBeDisabled();
  await viewer.getByRole("link", { name: "Plan & share" }).click();
  await expect(
    viewer.getByRole("button", { name: "Save from selected month" }),
  ).toBeDisabled();
  const members = await (await page.request.get("/api/v1/sharing/members")).json();
  expect(
    (
      await page.request.delete(`/api/v1/sharing/members/${members.members[0].id}`)
    ).status(),
  ).toBe(204);
  const id = await viewer.evaluate(() => sessionStorage.getItem("selected-budget"));
  expect(
    (
      await viewer.request.get("/api/v1/months/2026-07", {
        headers: { "X-Budget-Id": id },
      })
    ).status(),
  ).toBe(404);
  await context.close();
});

test("remembered login and comparison of three historical months using the controls", async ({
  page,
}) => {
  const email = `remember-${Date.now()}@example.test`;
  await register(page, email);
  await page.request.post("/api/v1/auth/logout");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await expect(page.getByLabel("Remember me for 90 days")).toBeChecked();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/budget/);
  const cookie = (await page.context().cookies()).find((c) => c.name === "bb_session");
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(89 * 86400);
  await page.getByRole("link", { name: "Insights", exact: true }).click();
  await page.getByLabel("Choose any month").fill("2020-01");
  await page.getByRole("button", { name: "View month", exact: true }).click();
  await expect(
    page.getByText("Total spent in January 2020", { exact: true }),
  ).toBeVisible();
  for (const month of ["2021-03", "2022-05"]) {
    await page.getByLabel("Choose any month").fill(month);
    await page.getByRole("button", { name: "Add to comparison", exact: true }).click();
  }
  await expect(page.locator(".insights-hero-total")).toHaveCount(3);
  await expect(
    page.getByText("Total spent in March 2021", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Total spent in May 2022", { exact: true })).toBeVisible();
  await page.getByLabel("Choose any month").fill("2019-01");
  await expect(
    page.getByRole("button", { name: "Add to comparison", exact: true }),
  ).toBeDisabled();
});
