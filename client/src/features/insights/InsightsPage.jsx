import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader } from "../../components/ui/AppHeader.jsx";
import { MonthTabs } from "../../components/ui/MonthTabs.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { ErrorState } from "../../components/ui/ErrorState.jsx";
import { useAuth } from "../../app/AuthProvider.jsx";
import { useInsightsQuery } from "../../api/hooks.js";
import { copy } from "../../lib/copy.js";
import { currentMonth, previousMonth, monthLabel } from "../../lib/dates.js";
import { formatMoney } from "../../lib/money.js";
import { BarChart } from "./charts/BarChart.jsx";
import { DonutChart } from "./charts/DonutChart.jsx";
import { LineChart } from "./charts/LineChart.jsx";
import "./InsightsPage.css";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const PANEL_ID = "insights-panel";

function InsightsSkeleton() {
  return (
    <div className="insights-loading" aria-busy="true" aria-label="Loading insights">
      <Skeleton height={88} />
      <Skeleton height={280} />
      <Skeleton height={280} />
    </div>
  );
}

/** Hero total + honest comparison line. Never claims a zero change when
 * there is nothing to compare (D-INS-F5). */
function InsightsHero({ insights }) {
  return (
    <div className="insights-hero">
      <p className="insights-hero-total">
        <span className="visually-hidden">
          {copy.insights.totalLabel(insights.monthLabel)}:{" "}
        </span>
        {formatMoney(insights.currentTotalMinor)}
      </p>
      {insights.hasPrevious ? (
        <p className="insights-hero-comparison">
          vs{" "}
          <span className="insights-hero-comparison-amount">
            {formatMoney(insights.previousTotalMinor)}
          </span>{" "}
          last month
        </p>
      ) : (
        <p className="insights-hero-comparison">
          {copy.insights.noComparison} —{" "}
          {copy.insights.noComparisonDetail(insights.previousMonthLabel)}
        </p>
      )}
      {insights.currentTotalMinor === 0 ? (
        <p className="insights-hero-comparison">
          {copy.insights.noSpending(insights.monthLabel)}
        </p>
      ) : null}
    </div>
  );
}

export function InsightsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedMonth = searchParams.get("month");
  const baseMonth = MONTH_PATTERN.test(requestedMonth ?? "")
    ? requestedMonth
    : currentMonth();

  const [selectedMonth, setSelectedMonth] = useState(baseMonth);
  useEffect(() => {
    setSelectedMonth(baseMonth);
  }, [baseMonth]);

  const insightsQuery = useInsightsQuery(selectedMonth);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const tabOptions = [
    {
      value: previousMonth(baseMonth),
      label: monthLabel(previousMonth(baseMonth)),
      tone: "previous",
    },
    { value: baseMonth, label: monthLabel(baseMonth), tone: "current" },
  ];

  function renderContent() {
    if (insightsQuery.isLoading) {
      return <InsightsSkeleton />;
    }
    if (insightsQuery.isError) {
      if (insightsQuery.error?.code === "NOT_FOUND") {
        return (
          <EmptyState
            title={copy.insights.emptyTitle(monthLabel(selectedMonth))}
            description={copy.insights.emptyDescription}
            actionLabel={copy.budget.createBudgetLabel}
            onAction={() => navigate(`/budget/new?month=${selectedMonth}`)}
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

    const { insights } = insightsQuery.data;
    return (
      <>
        <InsightsHero insights={insights} />
        <div className="insights-charts">
          <Card className="insights-card insights-card-bar">
            <h2 className="insights-card-title">{copy.insights.barChartTitle}</h2>
            <BarChart
              categories={insights.categories}
              monthLabel={insights.monthLabel}
              previousMonthLabel={insights.previousMonthLabel}
              hasPrevious={insights.hasPrevious}
            />
          </Card>
          <Card className="insights-card insights-card-donut">
            <h2 className="insights-card-title">{copy.insights.donutChartTitle}</h2>
            <DonutChart
              categories={insights.categories}
              totalMinor={insights.currentTotalMinor}
              monthLabel={insights.monthLabel}
            />
          </Card>
          <Card className="insights-card insights-card-line">
            <h2 className="insights-card-title">{copy.insights.lineChartTitle}</h2>
            <LineChart
              labels={insights.cashFlow.labels}
              currentSeries={insights.cashFlow.currentCumulativeMinor}
              previousSeries={insights.cashFlow.previousCumulativeMinor}
              monthLabel={insights.monthLabel}
              previousMonthLabel={insights.previousMonthLabel}
              hasPrevious={insights.hasPrevious}
            />
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
        onBack={() => navigate(`/budget?month=${selectedMonth}`)}
        backLabel={copy.insights.backToBudgetLabel}
        menuItems={[
          {
            label: copy.budget.title,
            onSelect: () => navigate(`/budget?month=${selectedMonth}`),
          },
        ]}
      />
      <main className="insights-main">
        <MonthTabs
          options={tabOptions}
          value={selectedMonth}
          onChange={setSelectedMonth}
          panelId={PANEL_ID}
        />
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`month-tab-${selectedMonth}`}
          className="insights-panel"
        >
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
