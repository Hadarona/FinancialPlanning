// Mirrors server/src/domain/categories.js. The category set is fixed
// (product decision #7): id/name/icon/color/displayOrder are constants; only
// plannedMinor (from the loaded budget) and incomeMinor are ever editable.

export const DEFAULT_CATEGORIES = [
  { id: "housing", name: "Housing", icon: "House", color: "blue", displayOrder: 1, plannedMinor: 400000 },
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
];

export const DEFAULT_CATEGORY_IDS = DEFAULT_CATEGORIES.map((category) => category.id);
