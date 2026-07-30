// Copy strings mirrored verbatim from docs/design/figma-kit/data/content.json.
// The kit does not define a dedicated "register" section; those strings are a
// minimal, voice-consistent extension (noted as a deviation in the build
// report) and should be reconciled with design review if the kit is updated.

export const copy = {
  login: {
    title: "Welcome back",
    emailLabel: "Email",
    passwordLabel: "Password",
    submitLabel: "Sign in",
    createAccountLabel: "Create account",
  },
  register: {
    title: "Create account",
    emailLabel: "Email",
    passwordLabel: "Password",
    submitLabel: "Create account",
    haveAccountLabel: "Already have an account? Sign in",
  },
  budget: {
    title: "Budget",
    addExpenseLabel: "Add expense",
    // Labels below mirror the approved Budget compositions
    // (docs/design/approved/*-budget.jpg); state/action strings are
    // voice-consistent extensions like the register section above.
    incomeLabel: "Income",
    plannedLabel: "Planned",
    availableLabel: "Available",
    createBudgetLabel: "Create budget",
    emptyDescription: "Set your income and plan your categories to get started.",
    loadErrorTitle: "Couldn't load your budget",
    loadErrorDescription: "Check your connection and try again.",
    retryLabel: "Try again",
    overPlanLabel: "over plan",
    unplannedLabel: "unplanned spending",
    overAllocatedWarning: "You've planned more than your income.",
  },
  expense: {
    // Voice-consistent extensions (the kit defines only "Add expense").
    amountLabel: "Amount",
    categoryLabel: "Category",
    categoryPlaceholder: "Choose a category",
    dateLabel: "Date",
    noteLabel: "Note (optional)",
    saveLabel: "Save expense",
    cancelLabel: "Cancel",
    addedStatus: "Expense added",
    deletedStatus: "Expense deleted",
    saveErrorTitle: "Couldn't save your expense.",
    retryLabel: "Try again",
    historyTitle: "Recent expenses",
    emptyHistory: "No expenses yet this month.",
    deleteTitle: "Delete expense",
    deleteConfirmLabel: "Delete",
    deleteErrorTitle: "Couldn't delete the expense.",
  },
  plan: {
    // Voice-consistent extensions for the budget create/edit form.
    createTitle: "Create budget",
    editTitle: "Edit budget",
    incomeLabel: "Income",
    plannedLabel: "Planned",
    availableLabel: "Available",
    saveLabel: "Save budget",
    cancelLabel: "Cancel",
    savedStatus: "Budget saved",
    saveErrorTitle: "Couldn't save your budget.",
    retryLabel: "Try again",
    conflictLinkLabel: "View existing budget",
    unsavedTitle: "Discard unsaved changes?",
    unsavedBody: "Your edits haven't been saved yet.",
    keepEditingLabel: "Keep editing",
    discardLabel: "Discard changes",
    previousMonthLabel: "Previous month",
    nextMonthLabel: "Next month",
  },
  insights: {
    title: "Spending insights",
    // "vs 9,180 last month" (kit comparisonLabel pattern); chart titles
    // mirror the approved Insights compositions. State/action strings are
    // voice-consistent extensions like the register section above.
    comparisonPattern: (amount) => `vs ${amount} last month`,
    barChartTitle: "Spending by category",
    donutChartTitle: "Spending by category",
    lineChartTitle: "Cash flow trend",
    menuLabel: "View insights",
    backToBudgetLabel: "Back to budget",
    noComparison: "No data to compare",
    noComparisonDetail: (previousLabel) =>
      `There's no ${previousLabel} budget yet, so there's nothing to compare.`,
    noSpending: (monthLabelText) => `No expenses recorded for ${monthLabelText} yet.`,
    totalLabel: (monthLabelText) => `Total spent in ${monthLabelText}`,
    loadErrorTitle: "Couldn't load your insights",
    loadErrorDescription: "Check your connection and try again.",
    retryLabel: "Try again",
    emptyTitle: (monthLabelText) => `No budget for ${monthLabelText} yet`,
    emptyDescription: "Create this month's budget to see spending insights.",
  },
  password: {
    show: "Show password",
    hide: "Hide password",
  },
  session: {
    expired: "Your session expired — please sign in again.",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    network: "You appear to be offline. Check your connection and try again.",
  },
};
