# Frontend Polish Prompt (Handoff)

Use this prompt when continuing UI work in this repository.

---

You are working on a Next.js frontend that was built mobile-first, then extended with desktop variants.

## Context

- Mobile screens were implemented first and are considered stable.
- Desktop screens were added after mobile.
- The code follows a two-screen strategy:
  - Preserve mobile and desktop structure.
  - Polish mobile and desktop separately.
  - Use desktop-specific UI blocks where needed.
  - Share logic and data wiring; split only presentation/layout when necessary.

## Current Objective

We are preparing the frontend for database connection.

Do **frontend-only** improvements that are subtle and consistent.

## Critical Constraints

- Do not change overall layouts or page structure.
- Do not redesign navigation or route flow.
- Do not alter mobile or desktop layout structure.
- Do not make backend, API, action, or schema changes.
- Keep interactions and information architecture intact.

## What To Improve (Subtle Only)

- Typography consistency across mobile and desktop:
  - Harmonize font sizes, weights, and line heights.
  - Ensure headings, labels, body text, and metadata are clearly tiered.
- Table-like sections:
  - Where content represents records/rows, make it read like a table.
  - Improve header/row alignment, spacing, and separators.
- Card consistency:
  - Standardize card padding, radius, border/ring usage, and spacing.
  - Keep visual rhythm consistent across modules.
- Entry distinction:
  - Make rows/cards easier to tell apart (subtle separators, spacing, hierarchy).

## Parity Checks (Required)

- Audit desktop and mobile action parity for each polished screen.
- If desktop has a user-facing action missing on mobile (for example, `Edit`), add a subtle mobile equivalent.
- Keep parity additions lightweight and consistent with the existing mobile visual language.

## Quality Bar

- Keep all existing layouts and screen compositions.
- Improve clarity, consistency, and readability without introducing a new design direction.
- Validate polish quality for both mobile and desktop independently.

---

Use this as the default instruction baseline for upcoming frontend polish tasks.
