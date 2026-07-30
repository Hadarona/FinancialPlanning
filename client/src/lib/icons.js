// Category icon lookup, restricted to the kit's icon map
// (docs/design/figma-kit/docs/icon-map.md). Never render an icon outside
// this map for category UI.

import { House, ShoppingCart, CarFront, PartyPopper, PiggyBank } from "lucide-react";

export const CATEGORY_ICONS = {
  House,
  ShoppingCart,
  CarFront,
  PartyPopper,
  PiggyBank,
};

export function categoryIcon(iconName) {
  return CATEGORY_ICONS[iconName] ?? null;
}
