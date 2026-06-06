# Agila Frontend

## Skills

Load **all three** when working on frontend:

- `frontend-design` — build polished UI
- `vercel-react-best-practices` — performance patterns
- `caveman` — terse responses

Use **pnpm** for all package commands. No npm. Check typsescript errors with `pnpm tsc --noEmit` or `pnpm build` (which also checks types). Do not write code in a pattern that triggers setState linter errors (synchronous calls may cause cascading renders).

## No Dev Server for Verification

Don't run `pnpm dev` to verify work. Trust the code.

## Schema

Super basic. Just know:

- Types live in `lib/types/` — shapes only, no logic
- Services in `lib/services/` — orchestration, business logic; **must go through `lib/repo/` for DB access, never call `db.*` directly**
- Repo/state in `lib/repo/` — all direct DB queries live here; add new query functions here as needed

See files themselves for specifics. Don't need schema details. When pushing new schema updates, do "pnpm drizzle-kit push", rather than generating and migrating.

## Photo Storage

Cat photos: Supabase `cat-photos` bucket, path `${catId}/photo.jpg` (upsert — re-uploads never orphan). Blobs are NOT FK-linked to rows, so cleanup is manual.

- **Never delete a cat blob by assuming `${catId}/photo.jpg` belongs only to that cat.** A merge can reassign a duplicate's `photo_url` to the surviving target, so a path may still be referenced after its owning row is gone. Always derive the path from `photo_url` and **reference-check** before removing (see `lib/services/cat-photo-storage.ts`, `cats.repo.findCatsReferencingPhotoPaths`).
- `removeCat` cleans its blob inline (reference-aware). Merges + region/bulk deletes rely on the GC sweep `reconcileCatPhotos` (Admin → GSheet Config → Reclaim orphaned photos).
- `deleteSession`/`removeSessionCat` only cascade the `session_cats` join row — the cat row + blob survive (known: session-less Unsubmitted cats accumulate).

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

## RBAC

Three roles: **Volunteer < Manager < Administrator**. Use `canManage` (`isAdmin || isManager`) from `useAuth()` for most gates.

- **Volunteer**: read-only on database detail screens (General/Medical tabs — disable inputs, hide save/cancel); full create/edit access inside session forms (that's their workflow)
- **Manager/Admin**: full CRUD on database; can approve sessions
- **Manager/Admin only**: Census Report button, Review Sessions button, database add/delete actions

## File Locations

- Pages: `app/`
- Components: `components/` (mobile/ and desktop/ subdirs as needed)
- Types: `lib/types/`
- Services: `lib/services/` (read-only)
- State: `lib/repo/` (read-only)
- Styles: Tailwind inline

No need for detailed file map — navigate by reading code structure.
