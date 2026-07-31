// The budgeting app's category set is fixed (product decision #7, extended
// by CR-001 item 2): exactly these seven categories exist per budget. Only
// `plannedMinor` (via a budget's own `categories` JSONB) and `incomeMinor`
// are ever user-editable — id, name, icon, color, and displayOrder are
// constants, never accepted from the client. Default planned prefill totals
// 12,000 (=> 1,200,000 minor units) against a default income of 12,500.

export const DEFAULT_CATEGORIES = [
  {
    id: "housing",
    name: "Housing",
    icon: "House",
    color: "blue",
    displayOrder: 1,
    plannedMinor: 400000,
  },
  {
    id: "groceries",
    name: "Groceries",
    icon: "ShoppingCart",
    color: "green",
    displayOrder: 2,
    plannedMinor: 150000,
  },
  {
    id: "transport",
    name: "Transport",
    icon: "CarFront",
    color: "yellow",
    displayOrder: 3,
    plannedMinor: 80000,
  },
  {
    id: "fun",
    name: "Fun",
    icon: "PartyPopper",
    color: "coral",
    displayOrder: 4,
    plannedMinor: 90000,
  },
  {
    id: "savings",
    name: "Savings",
    icon: "PiggyBank",
    color: "blue",
    displayOrder: 5,
    plannedMinor: 300000,
  },
  {
    id: "subscriptions",
    name: "Subscriptions",
    icon: "Repeat",
    color: "coral",
    displayOrder: 6,
    plannedMinor: 60000,
  },
  {
    id: "utilities",
    name: "Utilities",
    icon: "Plug",
    color: "green",
    displayOrder: 7,
    plannedMinor: 120000,
  },
];

export const DEFAULT_CATEGORY_IDS = DEFAULT_CATEGORIES.map((category) => category.id);

/** Default income (minor units) for auto-provisioned budgets: registration
 * (CR1-9), the migration backfill, and the defensive POST /budget path all
 * share this single source. */
export const DEFAULT_INCOME_MINOR = 1250000;
