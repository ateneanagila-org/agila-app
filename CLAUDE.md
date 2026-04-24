# Agila Frontend

## Skills

Load **all three** when working on frontend:

- `frontend-design` — build polished UI
- `vercel-react-best-practices` — performance patterns
- `caveman` — terse responses

Use **pnpm** for all package commands. No npm. Check typsescript errors with `pnpm tsc --noEmit` or `pnpm build` (which also checks types).

## No Dev Server for Verification

Don't run `pnpm dev` to verify work. Trust the code.

## Schema

Super basic. Just know:

- Types live in `lib/types/` — shapes only, no logic
- Services in `lib/services/` — data fetching, API calls
- Repo/state in `lib/repo/` — state management

See files themselves for specifics. Don't need schema details. When pushing new schema updates, do "pnpm drizzle-kit push", rather than generating and migrating.

## Desktop vs Mobile Layout

**Two-screen strategy** (see `frontend-guide.md` for full context):

Mobile is baseline, stable. Desktop gets variants when:

- Structure changes (panels, hierarchy, nav, workflow)
- Layout differs significantly

**Share:** logic, hooks, validation, actions, services
**Split:** only presentation/layout when needed

**Rules:**

- Don't refactor mobile just for desktop
- Keep components in clearly named files (mobile/desktop variants)
- Use responsive Tailwind in one component only for minor tweaks (spacing, sizing, alignment)
- Use separate components when desktop changes structure

## Design Theme

### Fonts

- **Headings:** `Gantari` (Google Fonts, tight tracking) — `font-heading` Tailwind class
- **Body:** `Gantari` (Google Fonts) — `font-sans` Tailwind class (default body font)

### Color Palette

| Token             | Tailwind class                 | Value                  | Use                               |
| ----------------- | ------------------------------ | ---------------------- | --------------------------------- |
| Brand green       | `bg-brand-green`               | `#529151`              | Headers, sidebar, nav bg          |
| Brand green light | `bg-brand-green-light`         | `#5fa35e`              | Hover/active on green             |
| Green foreground  | `text-brand-green-foreground`  | `oklch(0.99 0 0)`      | Text on green surfaces (white)    |
| Brand yellow      | `text-brand-yellow`            | `#f3f58e`              | Heading text on green backgrounds |
| Brand orange      | `bg-brand-orange`              | `#CE6B3B`              | CTA buttons, active indicators    |
| Orange foreground | `text-brand-orange-foreground` | `oklch(0.99 0 0)`      | Text on orange (white)            |
| Brand cream       | `bg-brand-cream`               | `oklch(0.97 0.012 82)` | Main content background           |
| Brand cream dark  | `bg-brand-cream-dark`          | `oklch(0.92 0.014 82)` | Subtle surfaces, hover            |
| Brand dark        | `bg-brand-dark`                | `#311A19`              | Bottom nav, dark shell            |

### Semantic mapping

- `--primary` → brand green (headers, primary actions)
- `--accent` → brand orange (CTAs, active states)
- `--background` → brand cream (page background)
- `--sidebar` → brand green (desktop sidebar)

### Rules

- Desktop: change **colors and fonts only** — no layout changes
- Mobile: change **colors, fonts, and layout** (hi-fi implementation)
- Never hardcode hex values — use brand tokens or Tailwind semantic classes
- `lime-*` → `brand-green-*`
- `slate-100` (bg) → `brand-cream`
- `slate-900` (dark shell) → `brand-dark`

## File Locations

- Pages: `app/`
- Components: `components/` (mobile/ and desktop/ subdirs as needed)
- Types: `lib/types/`
- Services: `lib/services/` (read-only)
- State: `lib/repo/` (read-only)
- Styles: Tailwind inline

No need for detailed file map — navigate by reading code structure.
