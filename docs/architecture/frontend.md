# Frontend Guide

## Two-Screen Strategy (Mobile + Widescreen)

Mobile is stable as a baseline, but can receive subtle parity updates.

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
- Any future UI change should check this guide first and preserve cross-screen parity.

## Current Status Summary

- Mobile-first screens were built and validated first.
- Desktop variants were implemented after mobile, while preserving mobile behavior.
- The codebase now follows a dual-screen pattern: stable mobile flow + desktop-specific presentation where needed.

## Next Phase (Frontend-Only Polish)

We are preparing for frontend connection with the database.

For this phase, polish both mobile and desktop. Keep current layout and navigation structure intact on each screen. No layout changes.

Allowed improvements:

- Improve and standardize typography across mobile and desktop.
- Make data sections that represent records look and behave like tables.
- Make card styling more consistent across pages and modules.
- Improve visual distinction between entries/rows/cards for better scanability.
- Run parity checks between mobile and desktop actions.
- If desktop has a user-facing action that mobile is missing (for example, `Edit`), add the equivalent mobile action in a subtle way.

Restrictions:

- Frontend changes only.
- No backend/data-layer changes.
- No structural redesign of pages.
- No disruption of existing route flows and interactions.
