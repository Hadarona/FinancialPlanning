# Accessibility Checklist

## Color and contrast

- Body text must meet WCAG AA contrast of at least `4.5:1`.
- Large text must meet at least `3:1`.
- White text on blue buttons must be checked against the implementation blue.
- Yellow surfaces must use near-black text.
- Never use color as the only distinction between July and June:
  - July uses solid blue.
  - June uses yellow plus a dashed line where applicable.
  - Every chart includes text labels or a legend.

## Keyboard

- All controls are reachable in logical order.
- Focus indicators are visible and not clipped.
- Month tabs support arrow-key navigation.
- Password visibility and menu icons have accessible labels.

## Forms

- Labels remain visible outside fields.
- Errors include text, not color alone.
- Error text is associated with the relevant input.
- Password visibility does not move keyboard focus.
- Submit state includes loading feedback.

## Touch and pointer targets

- Minimum touch target: `44 × 44 px`.
- Desktop pointer targets should not be smaller than `32 × 32 px`.
- Chart data points expose a tooltip through keyboard focus as well as pointer hover.

## Charts

- Provide a text summary for each chart.
- Legends identify series and categories explicitly.
- Tooltips show category, month, value, and units.
- Maintain legible labels at the smallest supported width.

## Typography and scaling

- Support browser text zoom to at least `200%`.
- Avoid fixed-height containers around multiline text.
- Use a minimum body size of `16 px`.

## Motion

- Avoid essential information conveyed only through animation.
- Respect reduced-motion preferences.
- Use short transitions of approximately `160–220 ms`.

