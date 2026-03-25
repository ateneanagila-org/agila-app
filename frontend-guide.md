# Frontend Guide

## Two-Screen Strategy (Mobile + Widescreen)

Mobile is already stable and must remain unchanged.

For widescreen, we use a hybrid approach:

- Keep existing mobile components as the source of truth for mobile behavior.
- Create separate desktop components when layout or interaction differs significantly.
- Use responsive Tailwind in a shared component only for minor visual adjustments.
- Reuse the same actions, services, hooks, and validation logic across both screen variants.

## Rule of Thumb

Use separate components when desktop changes structure (panels, hierarchy, navigation, workflow).

Use responsive Tailwind in one component when desktop only changes spacing, sizing, or alignment.

## Implementation Notes

- Do not refactor working mobile screens just to support desktop.
- Keep platform-specific UI in clearly named files (mobile/desktop variants).
- Keep data and business logic shared; only split presentation/layout.
- Any future UI change should check this guide first and preserve mobile parity.
