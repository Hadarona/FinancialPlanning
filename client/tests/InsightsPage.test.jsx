import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsightsPage } from "../src/features/insights/InsightsPage.jsx";
import { renderProviders } from "./testUtils.jsx";
import { apiClient, ApiError } from "../src/api/client.js";
import { currentMonth, previousMonth, monthLabel } from "../src/lib/dates.js";

vi.mock("../src/api/client.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const USER = { user: { id: "user-1", email: "a@b.com" } };

const BASE = currentMonth();
const PREVIOUS = previousMonth(BASE);
const BASE_LABEL = monthLabel(BASE);
const PREVIOUS_LABEL = monthLabel(PREVIOUS);

/** Kit insights fixture (content.json in minor units) for the base month. */
function insightsFixture(overrides = {}) {
  return {
    insights: {
      month: BASE,
      monthLabel: BASE_LABEL,
      previousMonth: PREVIOUS,
      previousMonthLabel: PREVIOUS_LABEL,
      hasPrevious: true,
      currentTotalMinor: 842000,
      previousTotalMinor: 918000,
      categories: [
        {
          id: "housing",
          label: "Housing",
          color: "blue",
          currentMinor: 395700,
          previousMinor: 430000,
          sharePercent: 47,
        },
        {
          id: "groceries",
          label: "Groceries",
          color: "green",
          currentMinor: 151600,
          previousMinor: 170000,
          sharePercent: 18,
        },
        {
          id: "transport",
          label: "Transport",
          color: "yellow",
          currentMinor: 84200,
          previousMinor: 90000,
          sharePercent: 10,
        },
        {
          id: "fun",
          label: "Fun",
          color: "coral",
          currentMinor: 92600,
          previousMinor: 100000,
          sharePercent: 11,
        },
        {
          id: "savings",
          label: "Savings",
          color: "blue",
          currentMinor: 117900,
          previousMinor: 128000,
          sharePercent: 14,
        },
      ],
      cashFlow: {
        labels: ["Jul 1", "Jul 6", "Jul 11", "Jul 16", "Jul 21", "Jul 26", "Jul 31"],
        currentCumulativeMinor: [60000, 180000, 310000, 460000, 590000, 730000, 842000],
        previousCumulativeMinor: [80000, 210000, 350000, 500000, 650000, 790000, 918000],
      },
      ...overrides,
    },
  };
}

/** The previous month viewed as its own insights month (fetched when the
 * previous tab is selected); May has no budget, so no comparison. */
function previousMonthFixture() {
  return {
    insights: {
      month: PREVIOUS,
      monthLabel: PREVIOUS_LABEL,
      previousMonth: previousMonth(PREVIOUS),
      previousMonthLabel: monthLabel(previousMonth(PREVIOUS)),
      hasPrevious: false,
      currentTotalMinor: 918000,
      previousTotalMinor: null,
      categories: [
        {
          id: "housing",
          label: "Housing",
          color: "blue",
          currentMinor: 430000,
          previousMinor: null,
          sharePercent: 47,
        },
        {
          id: "groceries",
          label: "Groceries",
          color: "green",
          currentMinor: 170000,
          previousMinor: null,
          sharePercent: 19,
        },
        {
          id: "transport",
          label: "Transport",
          color: "yellow",
          currentMinor: 90000,
          previousMinor: null,
          sharePercent: 10,
        },
        {
          id: "fun",
          label: "Fun",
          color: "coral",
          currentMinor: 100000,
          previousMinor: null,
          sharePercent: 11,
        },
        {
          id: "savings",
          label: "Savings",
          color: "blue",
          currentMinor: 128000,
          previousMinor: null,
          sharePercent: 13,
        },
      ],
      cashFlow: {
        labels: ["Jun 1", "Jun 6", "Jun 11", "Jun 16", "Jun 21", "Jun 26", "Jun 30"],
        currentCumulativeMinor: [80000, 210000, 350000, 500000, 650000, 790000, 918000],
        previousCumulativeMinor: [],
      },
    },
  };
}

function mockApi(fixturesByMonth) {
  apiClient.get.mockImplementation((path) => {
    if (path === "/auth/me") {
      return Promise.resolve(USER);
    }
    const match = path.match(/^\/insights\/(\d{4}-\d{2})$/);
    if (match && fixturesByMonth[match[1]]) {
      return fixturesByMonth[match[1]]();
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
}

beforeEach(() => {
  apiClient.get.mockReset();
});

describe("InsightsPage", () => {
  it("renders the kit fixture from one response: hero 8,420, comparison, summaries (D-INS-F1/F2)", async () => {
    mockApi({ [BASE]: () => Promise.resolve(insightsFixture()) });
    render(renderProviders(<InsightsPage />));

    expect((await screen.findAllByText("8,420")).length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector(".insights-hero-comparison").textContent).toBe(
      "vs 9,180 last month",
    );

    // Every chart carries an accessible data-derived text summary (D-INS-D4).
    expect(screen.getByText(new RegExp(`Housing 3,957 vs 4,300`))).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`${BASE_LABEL} spending shares: Housing 47%`)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(`Cumulative spending through ${BASE_LABEL} reached 8,420`),
      ),
    ).toBeInTheDocument();
  });

  it("shows donut legend percentages that total exactly 100 (documented rounding)", async () => {
    const fixture = insightsFixture();
    mockApi({ [BASE]: () => Promise.resolve(fixture) });
    render(renderProviders(<InsightsPage />));
    await screen.findAllByText("8,420");

    const shares = fixture.insights.categories.map((category) => category.sharePercent);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(100);
    for (const share of shares) {
      expect(screen.getAllByText(`${share}%`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("exposes equivalent data tables for keyboard/screen-reader users (D-INS-F4)", async () => {
    mockApi({ [BASE]: () => Promise.resolve(insightsFixture()) });
    render(renderProviders(<InsightsPage />));
    await screen.findAllByText("8,420");

    const cashFlowTable = screen.getByRole("table", {
      name: `Cumulative spending by date: ${BASE_LABEL} and ${PREVIOUS_LABEL}`,
    });
    expect(cashFlowTable).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Jul 16" })).toBeInTheDocument();

    const barTable = screen.getByRole("table", {
      name: `Spending by category: ${BASE_LABEL} and ${PREVIOUS_LABEL}`,
    });
    expect(barTable).toBeInTheDocument();

    // Chart data points are keyboard-focusable with full labels (D-INS-D3).
    expect(
      screen.getAllByRole("img", { name: `Housing — ${BASE_LABEL}: 3,957 USD` })[0],
    ).toHaveAttribute("tabindex", "0");
  });

  it("keeps hidden chart tables out of the layout width (DEV-SELFTEST-001 regression guard)", async () => {
    mockApi({ [BASE]: () => Promise.resolve(insightsFixture()) });
    render(renderProviders(<InsightsPage />));
    await screen.findAllByText("8,420");

    // Chromium's automatic table layout ignores the .visually-hidden 1px
    // width when the class sits on a <table> itself, letting the widest chart
    // table (measured 335px) push the page past a 320px viewport. jsdom
    // computes no layout, so this asserts the structural contract behind the
    // fix — the class lives on a 1px overflow-hidden block wrapper, never on
    // the table — while the real scrollWidth <= 320 measurement is recorded in
    // cycle-01/evidence/insights-320-recheck.json.
    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(3);
    for (const table of tables) {
      expect(table.classList.contains("visually-hidden")).toBe(false);
      const wrapper = table.closest(".visually-hidden");
      expect(wrapper).not.toBeNull();
      expect(wrapper.tagName).toBe("DIV");
      // The accessible data view survives the wrapper: caption plus column
      // and row headers stay exposed to assistive tech (D-INS-F4).
      expect(table.querySelector("caption")).not.toBeNull();
      expect(table.querySelectorAll("th[scope='col']").length).toBeGreaterThan(0);
      expect(table.querySelectorAll("th[scope='row']").length).toBeGreaterThan(0);
    }
  });

  it("switches months from the tabs with arrow keys and updates everything together (D-INS-F3, D-RESP-F3)", async () => {
    mockApi({
      [BASE]: () => Promise.resolve(insightsFixture()),
      [PREVIOUS]: () => Promise.resolve(previousMonthFixture()),
    });
    render(renderProviders(<InsightsPage />));
    await screen.findAllByText("8,420");

    const currentTab = screen.getByRole("tab", { name: BASE_LABEL });
    expect(currentTab).toHaveAttribute("aria-selected", "true");

    const user = userEvent.setup();
    currentTab.focus();
    await user.keyboard("{ArrowLeft}");

    // Hero total, labels, and summaries all now describe the previous month.
    expect((await screen.findAllByText("9,180")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("tab", { name: PREVIOUS_LABEL })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(apiClient.get).toHaveBeenCalledWith(`/insights/${PREVIOUS}`);
    expect(
      screen.getByText(
        new RegExp(`Cumulative spending through ${PREVIOUS_LABEL} reached 9,180`),
      ),
    ).toBeInTheDocument();
  });

  it("shows an explicit no-comparison state instead of a fake zero change (D-INS-F5)", async () => {
    const fixture = insightsFixture({
      hasPrevious: false,
      previousTotalMinor: null,
      cashFlow: {
        labels: ["Jul 1", "Jul 6", "Jul 11", "Jul 16", "Jul 21", "Jul 26", "Jul 31"],
        currentCumulativeMinor: [60000, 180000, 310000, 460000, 590000, 730000, 842000],
        previousCumulativeMinor: [],
      },
    });
    mockApi({ [BASE]: () => Promise.resolve(fixture) });
    render(renderProviders(<InsightsPage />));
    await screen.findAllByText("8,420");

    expect(screen.getByText(/No data to compare/)).toBeInTheDocument();
    expect(screen.queryByText(/last month/)).not.toBeInTheDocument();
    expect(screen.queryByText("vs 0 last month")).not.toBeInTheDocument();
  });

  it("shows the create-budget empty state when the month has no budget", async () => {
    mockApi({
      [BASE]: () =>
        Promise.reject(
          new ApiError({
            code: "NOT_FOUND",
            status: 404,
            message: "No budget for this month.",
          }),
        ),
    });
    render(renderProviders(<InsightsPage />));

    expect(
      await screen.findByText(`No budget for ${BASE_LABEL} yet`),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create budget" })).toBeInTheDocument();
  });

  it("keeps the shell and offers retry on failure", async () => {
    let calls = 0;
    mockApi({
      [BASE]: () => {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(
            new ApiError({
              code: "INTERNAL",
              status: 500,
              message: "Something went wrong.",
            }),
          );
        }
        return Promise.resolve(insightsFixture());
      },
    });
    render(renderProviders(<InsightsPage />));

    expect(await screen.findByText("Couldn't load your insights")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Spending insights" }),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect((await screen.findAllByText("8,420")).length).toBeGreaterThanOrEqual(1);
  });
});
