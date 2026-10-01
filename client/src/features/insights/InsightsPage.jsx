import { useState } from "react";
import { t, categoryName, language } from "../../lib/locale.js";
import { monthYearLabel, monthLabel } from "../../lib/dates.js";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader } from "../../components/ui/AppHeader.jsx";
import { MonthMultiSelect } from "../../components/ui/MonthMultiSelect.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { ErrorState } from "../../components/ui/ErrorState.jsx";
import { useAuth } from "../../app/AuthProvider.jsx";
import { useInsightsQuery, useCreateBudgetMutation } from "../../api/hooks.js";
import { copy } from "../../lib/copy.js";
import { currentMonth, lastMonths } from "../../lib/dates.js";
import { formatMoney } from "../../lib/money.js";
import { BarChart } from "./charts/BarChart.jsx";
import { DonutChart } from "./charts/DonutChart.jsx";
import { LineChart } from "./charts/LineChart.jsx";
import "./InsightsPage.css";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_OPTION_COUNT = 12;

/** Parses `?months=YYYY-MM,YYYY-MM` into a valid selection (1–3 unique
 * months, newest first) or null when absent/invalid — CR3-1: plain
 * `/insights` means the current calendar month. */
function parseMonthsParam(raw) {
  if (!raw) {
    return null;
  }
  const months = raw.split(",");
  const unique = [...new Set(months)];
  if (
    unique.length !== months.length ||
    months.length < 1 ||
    months.length > 3 ||
    !months.every((month) => MONTH_PATTERN.test(month))
  ) {
    return null;
  }
  return unique.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

function InsightsSkeleton() {
  return (
    <div className="insights-loading" aria-busy="true" aria-label="Loading insights">
      <Skeleton height={88} />
      <Skeleton height={280} />
      <Skeleton height={280} />
    </div>
  );
}

/** One hero total per selected month (newest first), each labelled with
 * its month + year (CR3-4). */
function InsightsHero({ insights }) {
  return (
    <div className="insights-hero">
      <div className="insights-hero-months">
        {insights.months.map((entry) => (
          <p key={entry.month} className="insights-hero-month">
            <span className="insights-hero-month-label">
              {copy.insights.totalLabel(entry.yearLabel)}
            </span>
            <span className="insights-hero-total">₪{formatMoney(entry.totalMinor)}</span>
            {entry.incomeMinor !== undefined && (
              <span className="insights-hero-month-label">
                {t("Income remaining", "נותר מההכנסה")}: ₪
                {formatMoney(entry.remainingMinor)} · {t("Planned", "מתוכנן")}: ₪
                {formatMoney(entry.plannedMinor)}
              </span>
            )}
          </p>
        ))}
      </div>
      {insights.combinedTotalMinor === 0 ? (
        <p className="insights-hero-comparison">
          {copy.insights.noSpending(
            insights.months.map((entry) => entry.yearLabel).join(", "),
          )}
        </p>
      ) : null}
    </div>
  );
}

export function InsightsPage() {
  const { logout } = useAuth();
  const [customMonth, setCustomMonth] = useState(currentMonth());
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // The URL is the selection state (shareable, back/forward friendly);
  // absent or invalid params mean the CR3-1 default: the current month.
  const selectedMonths = parseMonthsParam(searchParams.get("months")) ?? [currentMonth()];
  const monthOptions = [
    ...new Set([...selectedMonths, ...lastMonths(MONTH_OPTION_COUNT)]),
  ]
    .sort()
    .reverse();

  const insightsQuery = useInsightsQuery(selectedMonths);
  const createBudgetMutation = useCreateBudgetMutation();

  function handleSelectionChange(nextMonths) {
    setSearchParams({ months: nextMonths.join(",") });
  }

  async function handleCreateBudget() {
    try {
      await createBudgetMutation.mutateAsync();
    } catch {
      // The query error state keeps rendering; nothing extra to do here.
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function renderContent() {
    if (insightsQuery.isLoading) {
      return <InsightsSkeleton />;
    }
    if (insightsQuery.isError) {
      if (insightsQuery.error?.code === "NOT_FOUND") {
        return (
          <EmptyState
            title={copy.insights.emptyTitle}
            description={copy.insights.emptyDescription}
            actionLabel={copy.budget.createBudgetLabel}
            onAction={handleCreateBudget}
          />
        );
      }
      return (
        <ErrorState
          title={copy.insights.loadErrorTitle}
          description={copy.insights.loadErrorDescription}
          retryLabel={copy.insights.retryLabel}
          onRetry={() => insightsQuery.refetch()}
        />
      );
    }

    const insights = {
      ...insightsQuery.data.insights,
      months: insightsQuery.data.insights.months.map((m) => ({
        ...m,
        label: monthLabel(m.month),
        yearLabel: monthYearLabel(m.month),
        cashFlow: {
          ...m.cashFlow,
          labels: m.cashFlow.labels.map((label) =>
            language === "he"
              ? `${label.split(" ").at(-1)} ${monthLabel(m.month)}`
              : label,
          ),
        },
      })),
      categories: insightsQuery.data.insights.categories.map((c) => ({
        ...c,
        label: categoryName({ name: c.label }),
      })),
    };
    const monthsPhrase = insights.months.map((entry) => entry.yearLabel).join(", ");
    return (
      <>
        <InsightsHero insights={insights} />
        <div className="insights-charts">
          <Card className="insights-card insights-card-bar">
            <h2 className="insights-card-title">{copy.insights.barChartTitle}</h2>
            <BarChart months={insights.months} categories={insights.categories} />
          </Card>
          <Card className="insights-card insights-card-donut">
            <h2 className="insights-card-title">{copy.insights.donutChartTitle}</h2>
            <p className="chart-note">
              {t(
                "Shares show positive net spending. Refunds are included in totals and trends.",
                "החלוקה מציגה הוצאות נטו חיוביות. החזרים כלולים בסכומים ובמגמות.",
              )}
            </p>
            <DonutChart
              categories={insights.categories}
              totalMinor={insights.combinedTotalMinor}
              monthsLabel={monthsPhrase}
            />
          </Card>
          <Card className="insights-card insights-card-line">
            <h2 className="insights-card-title">{copy.insights.lineChartTitle}</h2>
            <LineChart months={insights.months} />
          </Card>
        </div>
      </>
    );
  }

  return (
    <div className="insights-page">
      <AppHeader
        title={copy.insights.title}
        onLogout={handleLogout}
        onBack={() => navigate("/budget")}
        backLabel={copy.insights.backToBudgetLabel}
        menuItems={[
          {
            label: copy.budget.title,
            onSelect: () => navigate("/budget"),
          },
        ]}
      />
      <main className="insights-main">
        <MonthMultiSelect
          options={monthOptions}
          selected={selectedMonths}
          onChange={handleSelectionChange}
        />
        <div className="specific-month">
          <label>
            {t("Choose any month", "בחירת חודש כלשהו")}
            <input
              type="month"
              value={customMonth}
              onChange={(e) => setCustomMonth(e.target.value)}
            />
          </label>
          <button
            disabled={!MONTH_PATTERN.test(customMonth)}
            onClick={() => handleSelectionChange([customMonth])}
          >
            {t("View month", "צפייה בחודש")}
          </button>
          <button
            disabled={
              !MONTH_PATTERN.test(customMonth) ||
              selectedMonths.length >= 3 ||
              selectedMonths.includes(customMonth)
            }
            onClick={() => handleSelectionChange([...selectedMonths, customMonth])}
          >
            {t("Add to comparison", "הוספה להשוואה")}
          </button>
        </div>
        <div className="insights-panel">{renderContent()}</div>
      </main>
    </div>
  );
}
