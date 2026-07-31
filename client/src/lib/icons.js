// Category icon lookup, restricted to the kit's icon map
// (docs/design/figma-kit/docs/icon-map.md) plus the CR-001 sanctioned
// extension (Repeat for Subscriptions, Plug for Utilities — same Lucide
// outline family). Never render an icon outside this map for category UI.

import {
  House,
  ShoppingCart,
  CarFront,
  PartyPopper,
  PiggyBank,
  Repeat,
  Plug,
} from "lucide-react";

export const CATEGORY_ICONS = {
  House,
  ShoppingCart,
  CarFront,
  PartyPopper,
  PiggyBank,
  Repeat,
  Plug,
};

export function categoryIcon(iconName) {
  return CATEGORY_ICONS[iconName] ?? null;
}
