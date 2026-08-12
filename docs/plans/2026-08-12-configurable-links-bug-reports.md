# P2 — Configurable Links & In-App Bug Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an administrator change the three referral links without a redeploy, and replace the GitHub-issues bug link with an in-app report form plus an Administrator-only triage screen.

**Architecture:** Links live as rows in the existing `system_config` key/value table and reach client components through a `LinksProvider` mounted beside `AuthProvider` in the protected layout — the same server-reads / client-provides shape that file already uses. `lib/constants.ts` keeps the current URLs as compiled-in fallbacks, so a missing row or a failed read degrades to today's behaviour and `app/error.tsx` never depends on the database. Bug reports get their own table, snapshotting reporter name and email so a report survives the reporter's deletion.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Drizzle ORM, Zod 4 + drizzle-zod, next-safe-action 8, Tailwind 4, Jest (node env).

**Spec:** [`docs/specs/2026-08-12-configurable-links-bug-reports-design.md`](../specs/2026-08-12-configurable-links-bug-reports-design.md)

## Global Constraints

- **pnpm only.** Never `npm`. Type-check with `pnpm tsc --noEmit`; test with `pnpm jest __tests__`; lint with `pnpm lint <paths>`.
- **Never run `pnpm dev` to verify.** Trust the code plus the type-checker and tests.
- **Schema changes use `pnpm drizzle-kit push`** — never generate/migrate.
- **New code must never call `db.*` from a service.** All DB access goes through `lib/repo/`. `system.service.ts` already violates this for `sync_frozen`; **leave those existing calls alone** and route only new functions through the repo.
- **Never hardcode hex brand values in components** — use brand tokens (`bg-brand-orange`, `text-brand-dark`, `bg-brand-cream`, …). Tailwind's `red-*` scale for error states is the established convention and is fine.
- **Do not write setState patterns that cascade renders.**
- **UI is not unit-tested in this codebase** (`testEnvironment: "node"`, no component tests). For UI tasks the verification is `pnpm tsc --noEmit` + `pnpm lint` + the suite staying green. **Never add React Testing Library.**
- **Any error raised while a modal is open must render inside that modal**, never in a surface the modal's scrim covers. (P1 fix-wave rule.)
- Mobile/desktop are sibling JSX branches in one file (`tablet:hidden` / `hidden tablet:block`). Keep both in sync.
- **Reporter identity is never client-supplied.** The submit schema accepts `message` only; the action reads identity from the session.
- Pre-existing whole-repo lint noise (2 errors, 3 warnings in `reverse-sync.service.ts`, `scripts/find-suffix-drift.ts`, `workers/sync-cron/src/index.ts`) is out of scope. Do not fix it; do not let it confuse verification.

## Task Order & Dependencies

```
Task 1  system repo + getLinks()         (constants, repo, service)      independent
Task 2  updateLinks() + action           (validation, service, action)   needs 1
Task 3  LinksProvider + dashboard swap   (context, layout, 3 screens)    needs 1
Task 4  Public catalog links             (2 pages, 2 screens)            needs 1
Task 5  LinkControls admin card          (admin-screen)                  needs 2
Task 6  bug_reports schema + repo        (enums, schema, validation, repo) independent
Task 7  bug-reports service              (service)                       needs 6
Task 8  Submit form                      (actions, user-details-dialog)  needs 7
Task 9  Admin card + triage subroute     (admin-screen, page, screen)    needs 7
```

Tasks 1 and 6 may run in either order. Tasks 3 and 4 may run in either order once 1 lands. Task 9 touches `admin-screen.tsx`, as does Task 5 — run 5 before 9.

---

### Task 1: System config repo and `getLinks()`

**Files:**
- Modify: `lib/constants.ts`
- Create: `lib/repo/system.repo.ts`
- Modify: `lib/services/system.service.ts`
- Create: `__tests__/services/links.test.ts`

**Interfaces:**
- Produces, consumed by Tasks 2–5:
  - `LINK_CONFIG_KEYS` and `DEFAULT_LINKS` and type `AppLinks` from `@/lib/constants`
  - `findSystemConfig()`, `upsertSystemConfig(key, value)`, `deleteSystemConfigKey(key)` from `@/lib/repo/system.repo`
  - `getLinks(): Promise<AppLinks>` from `@/lib/services/system.service`

**Background:** `system_config` is an existing `key` / `value` / `updated_at` table already holding `sync_frozen` and `sync_freeze_reason`. There is no `system.repo.ts` — `system.service.ts` calls `db.*` directly, contradicting the project's layering rule. New code follows the rule; the existing sync-freeze calls stay untouched.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/links.test.ts`:

```ts
jest.mock("@/lib/repo/system.repo", () => ({
  findSystemConfig: jest.fn(),
  upsertSystemConfig: jest.fn(),
  deleteSystemConfigKey: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import { getLinks } from "@/lib/services/system.service";
import * as systemRepo from "@/lib/repo/system.repo";
import { DEFAULT_LINKS } from "@/lib/constants";

const mockRepo = systemRepo as jest.Mocked<typeof systemRepo>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getLinks", () => {
  it("falls back to the compiled-in constant when no row exists", async () => {
    mockRepo.findSystemConfig.mockResolvedValue([] as never);

    await expect(getLinks()).resolves.toEqual(DEFAULT_LINKS);
  });

  it("lets a DB value override the constant", async () => {
    mockRepo.findSystemConfig.mockResolvedValue([
      { key: "link_census_report", value: "https://example.com/census" },
    ] as never);

    const links = await getLinks();

    expect(links.censusReport).toBe("https://example.com/census");
    // Unset keys still fall back.
    expect(links.referralSheet).toBe(DEFAULT_LINKS.referralSheet);
    expect(links.adoptFoster).toBe(DEFAULT_LINKS.adoptFoster);
  });

  it("ignores unrelated config keys", async () => {
    mockRepo.findSystemConfig.mockResolvedValue([
      { key: "sync_frozen", value: "true" },
    ] as never);

    await expect(getLinks()).resolves.toEqual(DEFAULT_LINKS);
  });

  it("treats a blank stored value as unset", async () => {
    mockRepo.findSystemConfig.mockResolvedValue([
      { key: "link_adopt_foster", value: "   " },
    ] as never);

    await expect(getLinks()).resolves.toEqual(DEFAULT_LINKS);
  });

  it("degrades to defaults when the read throws", async () => {
    mockRepo.findSystemConfig.mockRejectedValue(new Error("db down") as never);

    await expect(getLinks()).resolves.toEqual(DEFAULT_LINKS);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/links.test.ts`
Expected: FAIL — `getLinks is not a function` (the service does not export it yet).

- [ ] **Step 3: Add the link keys and defaults to `lib/constants.ts`**

Directly below the three existing URL constants (which keep their current values and their `// TODO` comments — those URLs are correct and now serve as fallbacks):

```ts
/**
 * system_config keys backing the admin-editable referral links.
 *
 * Defined once and shared by reader and writer so there is a single spelling —
 * system_config is untyped key/value, so a typo would silently yield the
 * fallback instead of an error.
 */
export const LINK_CONFIG_KEYS = {
  censusReport: "link_census_report",
  referralSheet: "link_referral_sheet",
  adoptFoster: "link_adopt_foster",
} as const;

export type AppLinks = {
  censusReport: string;
  referralSheet: string;
  adoptFoster: string;
};

/**
 * Compiled-in fallbacks. A missing or blank system_config row resolves to these,
 * so the feature ships with no migration step and no window where a link is
 * empty. app/error.tsx uses these directly — it is the crash boundary and must
 * never depend on a DB read.
 */
export const DEFAULT_LINKS: AppLinks = {
  censusReport: CENSUS_REPORT_URL,
  referralSheet: REFERRAL_SHEET_URL,
  adoptFoster: ADOPT_FOSTER_APPLICATION_URL,
};
```

- [ ] **Step 4: Create `lib/repo/system.repo.ts`**

```ts
import { eq } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";

type DB = typeof db | Transaction;

/** Every system_config row. The table is tiny (a handful of keys). */
export const findSystemConfig = (client: DB = db) =>
  client.select().from(systemConfig);

export const upsertSystemConfig = (
  key: string,
  value: string,
  client: DB = db,
) =>
  client
    .insert(systemConfig)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value, updatedAt: new Date() },
    });

export const deleteSystemConfigKey = (key: string, client: DB = db) =>
  client.delete(systemConfig).where(eq(systemConfig.key, key));
```

- [ ] **Step 5: Add `getLinks()` to `lib/services/system.service.ts`**

Extend the existing imports at the top of the file:

```ts
import * as systemRepo from "@/lib/repo/system.repo";
import { LINK_CONFIG_KEYS, DEFAULT_LINKS, type AppLinks } from "@/lib/constants";
```

Append to the file:

```ts
/**
 * Resolves the referral links, falling back to the compiled-in defaults for any
 * key that is missing or blank. Callers cannot tell a configured link from a
 * fallback — they just get a URL.
 *
 * A failed read degrades to defaults rather than propagating: a broken config
 * table should not blank every link in the app.
 */
export async function getLinks(): Promise<AppLinks> {
  let rows: Array<{ key: string; value: string }>;
  try {
    rows = await systemRepo.findSystemConfig();
  } catch (error) {
    console.warn(
      `getLinks: falling back to defaults — ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return DEFAULT_LINKS;
  }

  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const resolve = (key: string, fallback: string) => {
    const stored = byKey.get(key)?.trim();
    return stored ? stored : fallback;
  };

  return {
    censusReport: resolve(
      LINK_CONFIG_KEYS.censusReport,
      DEFAULT_LINKS.censusReport,
    ),
    referralSheet: resolve(
      LINK_CONFIG_KEYS.referralSheet,
      DEFAULT_LINKS.referralSheet,
    ),
    adoptFoster: resolve(
      LINK_CONFIG_KEYS.adoptFoster,
      DEFAULT_LINKS.adoptFoster,
    ),
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm jest __tests__/services/links.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Full suite, type-check, lint**

Run: `pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint lib/constants.ts lib/repo/system.repo.ts lib/services/system.service.ts`
Expected: all suites PASS, tsc exit 0, zero lint warnings on those paths.

- [ ] **Step 8: Commit**

```bash
git add lib/constants.ts lib/repo/system.repo.ts lib/services/system.service.ts __tests__/services/links.test.ts
git commit -m "feat(config): resolve referral links from system_config with constant fallbacks

Adds system.repo.ts (the first repo layer for system_config) and getLinks(),
which overlays stored values onto the compiled-in constants. A missing, blank
or unreadable row resolves to the current hardcoded URL, so behaviour is
unchanged until an admin sets one."
```

---

### Task 2: `updateLinks()` and the admin action

**Files:**
- Create: `lib/validation/system.ts`
- Modify: `lib/services/system.service.ts`
- Modify: `app/actions/system.ts`
- Modify: `__tests__/services/links.test.ts`

**Interfaces:**
- Consumes from Task 1: `LINK_CONFIG_KEYS`, `DEFAULT_LINKS`, `AppLinks`, `systemRepo.upsertSystemConfig`, `systemRepo.deleteSystemConfigKey`, `getLinks()`
- Produces, consumed by Task 5:
  - `updateLinksSchema` / `UpdateLinksInput` from `@/lib/validation/system`
  - `updateLinks(input): Promise<AppLinks>` from `@/lib/services/system.service`
  - `updateLinks` server action from `@/app/actions/system`
  - `getAppLinks` server action from `@/app/actions/system`

**Background:** Clearing a field must **delete** the row so the constant takes over again — writing an empty string would store a blank that `getLinks` then has to special-case at read time.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/services/links.test.ts`. Extend the service import at the top of that file from `import { getLinks }` to `import { getLinks, updateLinks } from "@/lib/services/system.service";`, and add `import { updateLinksSchema } from "@/lib/validation/system";`:

```ts
describe("updateLinks", () => {
  beforeEach(() => {
    mockRepo.findSystemConfig.mockResolvedValue([] as never);
  });

  it("upserts a provided URL", async () => {
    await updateLinks({ censusReport: "https://example.com/a" });

    expect(mockRepo.upsertSystemConfig).toHaveBeenCalledWith(
      "link_census_report",
      "https://example.com/a",
    );
    expect(mockRepo.deleteSystemConfigKey).not.toHaveBeenCalled();
  });

  it("deletes the row when a field is cleared, restoring the default", async () => {
    await updateLinks({ censusReport: null });

    expect(mockRepo.deleteSystemConfigKey).toHaveBeenCalledWith(
      "link_census_report",
    );
    expect(mockRepo.upsertSystemConfig).not.toHaveBeenCalled();
  });

  it("leaves untouched fields alone", async () => {
    await updateLinks({ adoptFoster: "https://example.com/form" });

    expect(mockRepo.upsertSystemConfig).toHaveBeenCalledTimes(1);
    expect(mockRepo.upsertSystemConfig).toHaveBeenCalledWith(
      "link_adopt_foster",
      "https://example.com/form",
    );
    expect(mockRepo.deleteSystemConfigKey).not.toHaveBeenCalled();
  });

  it("returns the freshly resolved links", async () => {
    mockRepo.findSystemConfig.mockResolvedValue([
      { key: "link_census_report", value: "https://example.com/a" },
    ] as never);

    const links = await updateLinks({ censusReport: "https://example.com/a" });

    expect(links.censusReport).toBe("https://example.com/a");
  });
});

describe("updateLinksSchema", () => {
  it("rejects a value that is not a URL", () => {
    expect(
      updateLinksSchema.safeParse({ censusReport: "not a url" }).success,
    ).toBe(false);
  });

  it("rejects a non-https URL", () => {
    expect(
      updateLinksSchema.safeParse({ censusReport: "http://example.com" })
        .success,
    ).toBe(false);
  });

  it("accepts null as an explicit clear", () => {
    expect(updateLinksSchema.safeParse({ censusReport: null }).success).toBe(
      true,
    );
  });

  it("rejects an empty payload", () => {
    expect(updateLinksSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/links.test.ts`
Expected: FAIL — `updateLinks is not a function`.

- [ ] **Step 3: Create `lib/validation/system.ts`**

```ts
import { z } from "zod";

/**
 * A referral link. `null` means "clear this and fall back to the compiled-in
 * default"; `undefined` means "leave it alone".
 */
const linkUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .startsWith("https://", "Link must start with https://")
  .max(2000, "URL too long")
  .nullable();

export const updateLinksSchema = z
  .object({
    censusReport: linkUrl.optional(),
    referralSheet: linkUrl.optional(),
    adoptFoster: linkUrl.optional(),
  })
  .refine(
    (v) =>
      v.censusReport !== undefined ||
      v.referralSheet !== undefined ||
      v.adoptFoster !== undefined,
    { message: "Provide at least one link to update." },
  );

export type UpdateLinksInput = z.infer<typeof updateLinksSchema>;
```

- [ ] **Step 4: Add `updateLinks()` to `lib/services/system.service.ts`**

Append to the file:

```ts
/**
 * Writes referral links. A `null` clears the key by DELETING the row rather
 * than storing an empty string, so the compiled-in default takes over cleanly
 * on the next read. An absent field is left untouched.
 */
export async function updateLinks(
  input: Partial<Record<keyof AppLinks, string | null>>,
): Promise<AppLinks> {
  for (const field of Object.keys(LINK_CONFIG_KEYS) as Array<keyof AppLinks>) {
    const value = input[field];
    if (value === undefined) continue;

    const key = LINK_CONFIG_KEYS[field];
    if (value === null) {
      await systemRepo.deleteSystemConfigKey(key);
    } else {
      await systemRepo.upsertSystemConfig(key, value);
    }
  }

  return await getLinks();
}
```

- [ ] **Step 5: Add the actions to `app/actions/system.ts`**

Extend the existing service import to include `getLinks` and `updateLinks as updateLinksService`, add `import { updateLinksSchema } from "@/lib/validation/system";`, and ensure `requireAuth`, `requireRole` and `ADMIN_ONLY` are imported from `@/lib/auth/rbac`. Then append:

```ts
export const getAppLinks = actionClient
  .schema(z.object({}))
  .action(async () => {
    await requireAuth();
    return await getLinks();
  });

export const updateLinks = actionClient
  .schema(updateLinksSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await updateLinksService(parsedInput);
  });
```

If `z` is not already imported in this file, add `import { z } from "zod";`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm jest __tests__/services/links.test.ts`
Expected: PASS, 13 tests (5 from Task 1 + 4 service + 4 schema).

- [ ] **Step 7: Full suite, type-check, lint**

Run: `pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint lib/validation/system.ts lib/services/system.service.ts app/actions/system.ts`
Expected: all PASS, tsc exit 0, zero lint warnings.

- [ ] **Step 8: Commit**

```bash
git add lib/validation/system.ts lib/services/system.service.ts app/actions/system.ts __tests__/services/links.test.ts
git commit -m "feat(config): admin-editable referral links

updateLinks writes each provided field and DELETES the row when a field is
cleared, so the compiled-in constant takes over again rather than a blank
string being stored. Admin-only; reading requires auth only."
```

---

### Task 3: `LinksProvider` and the dashboard consumers

**Files:**
- Create: `contexts/links-context.tsx`
- Modify: `app/(protected)/layout.tsx`
- Modify: `components/app-pages/sessions/sessions-screen.tsx`
- Modify: `components/app-pages/sessions/sessions-manager-screen.tsx`
- Modify: `components/app-pages/database/database-list-screen.tsx`

**Interfaces:**
- Consumes from Task 1: `getLinks()` from `@/lib/services/system.service`, `AppLinks` from `@/lib/constants`
- Produces: `LinksProvider` and `useLinks(): AppLinks` from `@/contexts/links-context`

**Background:** `app/(protected)/layout.tsx` already reads user + profile server-side and hands them to the client `AuthProvider`. This mirrors that exactly. Because the layout awaits before rendering children, the links are present on first paint — no stale UI, no client refetch.

The three dashboard files hold **seven** `href={CONSTANT}` usages: `sessions-screen.tsx` ×3, `sessions-manager-screen.tsx` ×2, `database-list-screen.tsx` ×2.

- [ ] **Step 1: Create `contexts/links-context.tsx`**

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppLinks } from "@/lib/constants";

const LinksContext = createContext<AppLinks | null>(null);

/**
 * Distributes the referral links resolved server-side in (protected)/layout.tsx,
 * mirroring how AuthProvider distributes the profile. Values are already
 * resolved against the compiled-in defaults, so consumers cannot tell a
 * configured link from a fallback.
 */
export function LinksProvider({
  children,
  links,
}: {
  children: ReactNode;
  links: AppLinks;
}) {
  return <LinksContext.Provider value={links}>{children}</LinksContext.Provider>;
}

export function useLinks(): AppLinks {
  const context = useContext(LinksContext);
  if (!context) {
    throw new Error("useLinks must be used within LinksProvider");
  }
  return context;
}
```

The value is passed straight through with no `useMemo`: `links` is a fresh object per server render and the provider re-renders only when the layout does, so memoising would add a dependency without removing a render.

- [ ] **Step 2: Mount the provider in `app/(protected)/layout.tsx`**

Add the imports:

```tsx
import { LinksProvider } from "@/contexts/links-context";
import { getLinks } from "@/lib/services/system.service";
```

Resolve the links alongside the profile. Replace the `findProfiles` line with:

```tsx
  const [profiles, links] = await Promise.all([
    findProfiles({ id: user.id }),
    getLinks(),
  ]);
```

and wrap the existing provider:

```tsx
  return (
    <AuthProvider userData={{ supabaseUser: user, profile }}>
      <LinksProvider links={links}>{children}</LinksProvider>
    </AuthProvider>
  );
```

- [ ] **Step 3: Swap `sessions-screen.tsx`**

Delete `import { CENSUS_REPORT_URL } from "@/lib/constants";`, add `import { useLinks } from "@/contexts/links-context";`, and inside the component body add:

```tsx
  const { censusReport } = useLinks();
```

Replace all three `href={CENSUS_REPORT_URL}` with `href={censusReport}`.

- [ ] **Step 4: Swap `sessions-manager-screen.tsx`**

Delete `import { CENSUS_REPORT_URL } from "@/lib/constants";`, add `import { useLinks } from "@/contexts/links-context";`, and inside the component body add:

```tsx
  const { censusReport } = useLinks();
```

Replace both `href={CENSUS_REPORT_URL}` with `href={censusReport}`.

- [ ] **Step 5: Swap `database-list-screen.tsx`**

Delete `import { REFERRAL_SHEET_URL } from "@/lib/constants";`, add `import { useLinks } from "@/contexts/links-context";`, and inside the component body add:

```tsx
  const { referralSheet } = useLinks();
```

Replace both `href={REFERRAL_SHEET_URL}` with `href={referralSheet}`.

- [ ] **Step 6: Confirm `app/error.tsx` was NOT touched**

Run: `grep -n "REFERRAL_SHEET_URL" app/error.tsx`
Expected: two lines (the import and the `href`). `app/error.tsx` is the global error boundary — it sits outside every provider and renders when the app has crashed, possibly because the database is unreachable. It must keep using the constant. If this grep returns nothing, you wrongly converted it; restore it.

- [ ] **Step 7: Confirm no dashboard consumer still imports the constants**

Run: `grep -rn "CENSUS_REPORT_URL\|REFERRAL_SHEET_URL" --include="*.tsx" components`
Expected: no output.

- [ ] **Step 8: Type-check, lint, test**

Run: `pnpm tsc --noEmit && pnpm jest __tests__ && pnpm lint contexts/links-context.tsx "app/(protected)/layout.tsx" components/app-pages/sessions/sessions-screen.tsx components/app-pages/sessions/sessions-manager-screen.tsx components/app-pages/database/database-list-screen.tsx`
Expected: tsc exit 0, all suites PASS, zero lint warnings.

- [ ] **Step 9: Commit**

```bash
git add contexts/links-context.tsx "app/(protected)/layout.tsx" components/app-pages/sessions/sessions-screen.tsx components/app-pages/sessions/sessions-manager-screen.tsx components/app-pages/database/database-list-screen.tsx
git commit -m "feat(config): distribute referral links via LinksProvider

The protected layout resolves links server-side and hands them to a client
provider, mirroring AuthProvider in the same file — so values are present on
first paint with no client fetch. app/error.tsx deliberately keeps the
constant: it is the crash boundary and must not depend on a DB read."
```

---

### Task 4: Public catalog links

**Files:**
- Modify: `app/(public)/(home)/page.tsx`
- Modify: `app/(public)/catalog/[id]/page.tsx`
- Modify: `components/app-pages/catalog/catalog-screen.tsx`
- Modify: `components/app-pages/catalog/catalog-detail-screen.tsx`

**Interfaces:**
- Consumes from Task 1: `getLinks()` from `@/lib/services/system.service`
- Produces: `CatalogScreen` and `CatalogDetailScreen` each gain a required `adoptFosterUrl: string` prop.

**Background:** These two pages render outside `(protected)/layout.tsx`, so `LinksProvider` does not reach them.

Note their current shape — **neither page loads any data today**. `(home)/page.tsx` is a synchronous server component, and `catalog/[id]/page.tsx` only awaits `params`; both catalog screens fetch their own cats client-side. So there is no existing `Promise.all` to extend — `(home)/page.tsx` has to *become* async. `app/(public)/catalog/page.tsx` only redirects to `/` and needs no change.

- [ ] **Step 1: Read links in `app/(public)/(home)/page.tsx`**

The file is currently three lines. Replace it entirely:

```tsx
import { CatalogScreen } from "@/components/app-pages/catalog/catalog-screen";
import { getLinks } from "@/lib/services/system.service";

export default async function HomePage() {
  const links = await getLinks();
  return <CatalogScreen adoptFosterUrl={links.adoptFoster} />;
}
```

The component becomes `async` — that is the change that matters. `getLinks()` never throws (it catches and returns defaults), so no error handling is needed here.

- [ ] **Step 2: Accept the prop in `catalog-screen.tsx`**

Delete `import { ADOPT_FOSTER_APPLICATION_URL } from "@/lib/constants";`. Add `adoptFosterUrl: string` to the component's props type, destructure it, and replace `href={ADOPT_FOSTER_APPLICATION_URL}` with `href={adoptFosterUrl}`.

- [ ] **Step 3: Read links in `app/(public)/catalog/[id]/page.tsx`**

This page is already `async` (it awaits `params`). Resolve both together:

```tsx
import { CatalogDetailScreen } from "@/components/app-pages/catalog/catalog-detail-screen";
import { getLinks } from "@/lib/services/system.service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CatalogDetailPage({ params }: PageProps) {
  const [{ id }, links] = await Promise.all([params, getLinks()]);
  return <CatalogDetailScreen catId={id} adoptFosterUrl={links.adoptFoster} />;
}
```

- [ ] **Step 4: Accept the prop in `catalog-detail-screen.tsx`**

Delete `import { ADOPT_FOSTER_APPLICATION_URL } from "@/lib/constants";`. Add `adoptFosterUrl: string` to the props type, destructure it, and replace `href={ADOPT_FOSTER_APPLICATION_URL}` with `href={adoptFosterUrl}`.

- [ ] **Step 5: Confirm the constant has no remaining consumers**

Run: `grep -rn "ADOPT_FOSTER_APPLICATION_URL" --include="*.tsx" --include="*.ts" app components`
Expected: no output. (The constant itself stays defined in `lib/constants.ts`, where `DEFAULT_LINKS` references it.)

- [ ] **Step 6: Type-check, lint, test**

Run: `pnpm tsc --noEmit && pnpm jest __tests__ && pnpm lint "app/(public)/(home)/page.tsx" "app/(public)/catalog/[id]/page.tsx" components/app-pages/catalog/catalog-screen.tsx components/app-pages/catalog/catalog-detail-screen.tsx`
Expected: tsc exit 0, all suites PASS, zero lint warnings.

- [ ] **Step 7: Commit**

```bash
git add "app/(public)/(home)/page.tsx" "app/(public)/catalog/[id]/page.tsx" components/app-pages/catalog/catalog-screen.tsx components/app-pages/catalog/catalog-detail-screen.tsx
git commit -m "feat(catalog): read the adopt/foster link from config

The public catalog renders outside (protected)/layout.tsx, so LinksProvider
does not reach it. Both public pages resolve the link server-side and pass it
down as a prop."
```

---

### Task 5: `LinkControls` admin card

**Files:**
- Create: `components/app-pages/admin/link-controls.tsx`
- Modify: `app/(protected)/dashboard/admin/page.tsx`
- Modify: `components/app-pages/admin/admin-screen.tsx`

**Interfaces:**
- Consumes from Task 2: `updateLinks` action from `@/app/actions/system`, `AppLinks` from `@/lib/constants`
- Consumes from Task 1: `getLinks()` from `@/lib/services/system.service`
- Produces: `LinkControls` requiring `initialLinks: AppLinks`; `AdminScreen` gains `initialLinks: AppLinks`.

**Background:** `admin-screen.tsx` renders its config cards in **both** branches — mobile around the `<div className="space-y-4 pb-20">` block and desktop just below it. `GSheetConfigControls` and `RegionControls` sit in both; `LinkControls` joins them in both.

`admin/page.tsx` already server-seeds users, sync status and regions through one `Promise.all`; links join it, per the rule that all async loads gate the route's skeleton.

- [ ] **Step 1: Create `components/app-pages/admin/link-controls.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateLinks } from "@/app/actions/system";
import type { AppLinks } from "@/lib/constants";

type LinkField = {
  key: keyof AppLinks;
  label: string;
  hint: string;
};

const LINK_FIELDS: LinkField[] = [
  {
    key: "censusReport",
    label: "Census Report",
    hint: "Google Doc opened from the Sessions screens.",
  },
  {
    key: "referralSheet",
    label: "Referral Sheet",
    hint: "Google Sheet opened from the Database screen.",
  },
  {
    key: "adoptFoster",
    label: "Adopt / Foster Form",
    hint: "Application form linked from the public catalog.",
  },
];

export function LinkControls({ initialLinks }: { initialLinks: AppLinks }) {
  const [links, setLinks] = useState<AppLinks>(initialLinks);
  const [draft, setDraft] = useState<AppLinks>(initialLinks);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = LINK_FIELDS.some((f) => draft[f.key].trim() !== links[f.key]);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const payload: Partial<Record<keyof AppLinks, string | null>> = {};
        for (const field of LINK_FIELDS) {
          const next = draft[field.key].trim();
          if (next === links[field.key]) continue;
          payload[field.key] = next === "" ? null : next;
        }

        const res = await updateLinks(payload);
        if (res?.serverError) throw new Error(res.serverError);

        const resolved = res?.data as AppLinks | undefined;
        if (!resolved) {
          // next-safe-action returns neither `data` nor `serverError` when the
          // zod schema rejects the payload. Without this branch the save would
          // silently do nothing — the failure mode P1 spent a fix wave closing.
          throw new Error("One of the links is not a valid https:// URL.");
        }
        setLinks(resolved);
        setDraft(resolved);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save links.");
      }
    });
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-brand-dark">Referral Links</h2>
      <div className="rounded-2xl bg-white ring-1 ring-border">
        <div className="space-y-3 px-4 py-4">
          <p className="text-xs text-brand-dark/60">
            Clear a field to restore the built-in default.
          </p>

          {LINK_FIELDS.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`link-${field.key}`}
                className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/60"
              >
                {field.label}
              </label>
              <input
                id={`link-${field.key}`}
                type="url"
                inputMode="url"
                value={draft[field.key]}
                onChange={(e) => {
                  setSaved(false);
                  setDraft((prev) => ({ ...prev, [field.key]: e.target.value }));
                }}
                placeholder="https://…"
                className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
              />
              <p className="mt-1 text-[11px] text-brand-dark/45">{field.hint}</p>
            </div>
          ))}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
          {saved && !error && (
            <p className="text-xs font-semibold text-brand-green">
              Links saved.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isPending || !dirty}
              onClick={() => {
                setDraft(links);
                setError(null);
                setSaved(false);
              }}
              className="rounded-full px-4 py-2 text-sm font-bold text-brand-dark/60 disabled:opacity-40"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={isPending || !dirty}
              onClick={handleSave}
              className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {isPending ? "Saving…" : "Save links"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Seed links in `app/(protected)/dashboard/admin/page.tsx`**

Add `import { getLinks } from "@/lib/services/system.service";`. Extend the existing `Promise.all` — it currently destructures `[users, syncStatus, regions]` — by appending a fourth entry and destructuring it:

```tsx
  const [users, syncStatus, regions, links] = await Promise.all([
    // …the three existing loadData(...) entries, unchanged…
    getLinks(),
  ]);
```

and pass it down:

```tsx
    <AdminScreen
      initialUsers={users}
      initialSyncStatus={syncStatus}
      initialRegions={regions}
      initialLinks={links}
    />
```

- [ ] **Step 3: Thread the prop through `admin-screen.tsx`**

Add the imports:

```tsx
import { LinkControls } from "./link-controls";
import type { AppLinks } from "@/lib/constants";
```

Add `initialLinks: AppLinks;` to `AdminScreenProps`, destructure `initialLinks` in the component signature, and render `LinkControls` in **both** branches, immediately after `<RegionControls initialRegions={initialRegions} />` in each:

```tsx
            <LinkControls initialLinks={initialLinks} />
```

- [ ] **Step 4: Confirm both branches render it**

Run: `grep -c "LinkControls initialLinks" components/app-pages/admin/admin-screen.tsx`
Expected: `2`. A single render site means you missed a branch — `tsc` will not catch this.

- [ ] **Step 5: Type-check, lint, test**

Run: `pnpm tsc --noEmit && pnpm jest __tests__ && pnpm lint components/app-pages/admin/link-controls.tsx components/app-pages/admin/admin-screen.tsx "app/(protected)/dashboard/admin/page.tsx"`
Expected: tsc exit 0, all suites PASS, zero lint warnings.

- [ ] **Step 6: Commit**

```bash
git add components/app-pages/admin/link-controls.tsx components/app-pages/admin/admin-screen.tsx "app/(protected)/dashboard/admin/page.tsx"
git commit -m "feat(admin): edit referral links from the Admin screen

Adds a Referral Links card in both breakpoints. Clearing a field sends null,
which deletes the system_config row so the built-in default takes over again."
```

---

### Task 6: `bug_reports` schema, validation and repo

**Files:**
- Modify: `lib/db/enums.ts`
- Modify: `lib/db/schema.ts`
- Create: `lib/validation/bug-reports.ts`
- Create: `lib/repo/bug-reports.repo.ts`

**Interfaces:**
- Produces, consumed by Tasks 7–9:
  - `BUG_REPORT_STATUS_VALUES`, `bugReportStatusEnum`, type `BugReportStatus` from `@/lib/db/enums`
  - `bugReports` table from `@/lib/db/schema`
  - `createBugReportSchema` / `CreateBugReportInput`, `setBugReportStatusSchema`, `deleteBugReportSchema` from `@/lib/validation/bug-reports`
  - `findBugReports`, `countOpenBugReports`, `insertBugReport`, `updateBugReport`, `deleteBugReport`, type `BugReport` from `@/lib/repo/bug-reports.repo`

**Background:** `profiles.id` cascades from `supabaseUsers.id`, and removing someone from the allowlist deletes their auth user. A plain FK would therefore delete that person's bug reports along with them — so the FK is `ON DELETE SET NULL` and name/email are snapshotted at write time.

**Note on testing this guarantee.** The spec lists "reporter deletion → report survives with `reporter_id = null`, snapshot intact" as a test. It is **not** automatable in this suite: every test file mocks the DB (`testEnvironment: "node"`, no test database), so `ON DELETE SET NULL` — a Postgres-level behaviour — never actually executes. It is covered by the manual checklist in Final Verification instead. Do not fake it with a mock that merely asserts the schema literal; that tests the plan, not the database.

- [ ] **Step 1: Add the status enum to `lib/db/enums.ts`**

Following the file's existing pattern (a `_VALUES` tuple, a `pgEnum`, and an exported type):

```ts
export const BUG_REPORT_STATUS_VALUES = ["Open", "Resolved"] as const;
export const bugReportStatusEnum = pgEnum(
  "bug_report_status",
  BUG_REPORT_STATUS_VALUES,
);
export type BugReportStatus = (typeof BUG_REPORT_STATUS_VALUES)[number];
```

- [ ] **Step 2: Add the table to `lib/db/schema.ts`**

Add `bugReportStatusEnum` to the existing import from `./enums`, then append the table:

```ts
/**
 * User-submitted bug reports.
 *
 * reporter_name / reporter_email are SNAPSHOTS, not derived. profiles.id
 * cascades from supabaseUsers.id and removing someone from the allowlist
 * deletes their auth user — so a cascading FK would delete their reports too.
 * SET NULL plus the snapshot keeps a report readable after its reporter is
 * gone, which is exactly when it still matters.
 */
export const bugReports = pgTable("bug_reports", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  message: text("message").notNull(),
  reporter_id: uuid("reporter_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  reporter_name: text("reporter_name"),
  reporter_email: text("reporter_email").notNull(),
  status: bugReportStatusEnum("status").notNull().default("Open"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  resolved_at: timestamp("resolved_at"),
});
```

- [ ] **Step 3: Push the schema**

Run: `pnpm drizzle-kit push`
Expected: creates the `bug_report_status` enum and the `bug_reports` table. Never use generate/migrate in this project.

- [ ] **Step 4: Create `lib/validation/bug-reports.ts`**

```ts
import { z } from "zod";
import { BUG_REPORT_STATUS_VALUES } from "@/lib/db/enums";

/**
 * Submit payload. Deliberately carries NO identity fields — the action reads
 * the reporter from the session, so a reporter cannot attribute a report to
 * someone else.
 */
export const createBugReportSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Describe the problem before sending.")
    .max(2000, "Please keep the report under 2000 characters."),
});

export const setBugReportStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(BUG_REPORT_STATUS_VALUES),
});

export const deleteBugReportSchema = z.object({
  id: z.string().uuid(),
});

export type CreateBugReportInput = z.infer<typeof createBugReportSchema>;
```

- [ ] **Step 5: Create `lib/repo/bug-reports.repo.ts`**

```ts
import { desc, eq, sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { bugReports } from "@/lib/db/schema";
import type { BugReportStatus } from "@/lib/db/enums";

type DB = typeof db | Transaction;

/** Newest first. Pass a status to filter; omit for all. */
export const findBugReports = (
  filter: { status?: BugReportStatus } = {},
  client: DB = db,
) => {
  const query = client.select().from(bugReports);
  return filter.status
    ? query.where(eq(bugReports.status, filter.status)).orderBy(desc(bugReports.created_at))
    : query.orderBy(desc(bugReports.created_at));
};

export const countOpenBugReports = async (client: DB = db) => {
  const [row] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(bugReports)
    .where(eq(bugReports.status, "Open"));
  return row?.count ?? 0;
};

export const insertBugReport = (
  data: {
    message: string;
    reporter_id: string | null;
    reporter_name: string | null;
    reporter_email: string;
  },
  client: DB = db,
) => client.insert(bugReports).values(data).returning();

export const updateBugReport = (
  id: string,
  data: { status: BugReportStatus; resolved_at: Date | null },
  client: DB = db,
) =>
  client.update(bugReports).set(data).where(eq(bugReports.id, id)).returning();

export const deleteBugReport = (id: string, client: DB = db) =>
  client.delete(bugReports).where(eq(bugReports.id, id)).returning();

export type BugReport = Awaited<ReturnType<typeof findBugReports>>[number];
```

- [ ] **Step 6: Type-check, lint, test**

Run: `pnpm tsc --noEmit && pnpm jest __tests__ && pnpm lint lib/db/enums.ts lib/db/schema.ts lib/validation/bug-reports.ts lib/repo/bug-reports.repo.ts`
Expected: tsc exit 0, all suites PASS (unchanged count — this task adds no tests; the service tests land in Task 7), zero lint warnings.

- [ ] **Step 7: Commit**

```bash
git add lib/db/enums.ts lib/db/schema.ts lib/validation/bug-reports.ts lib/repo/bug-reports.repo.ts
git commit -m "feat(bug-reports): add bug_reports table, validation and repo

reporter_id is ON DELETE SET NULL with snapshotted name/email: profiles
cascades from supabaseUsers, so removing someone from the allowlist would
otherwise delete their reports along with them."
```

---

### Task 7: Bug reports service

**Files:**
- Create: `lib/services/bug-reports.service.ts`
- Create: `__tests__/services/bug-reports.test.ts`

**Interfaces:**
- Consumes from Task 6: everything in `@/lib/repo/bug-reports.repo`, `BugReportStatus`
- Produces, consumed by Tasks 8–9:
  - `createBugReport({ message, reporter: { id, name, email } })`
  - `setBugReportStatus(id, status)`
  - `removeBugReport(id)`
  - all from `@/lib/services/bug-reports.service`

**Background:** The service takes the reporter as an argument rather than reading the session itself — auth belongs in the action layer, and passing it in keeps the service pure and testable.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/bug-reports.test.ts`:

```ts
jest.mock("@/lib/repo/bug-reports.repo", () => ({
  findBugReports: jest.fn(),
  countOpenBugReports: jest.fn(),
  insertBugReport: jest.fn(),
  updateBugReport: jest.fn(),
  deleteBugReport: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import {
  createBugReport,
  setBugReportStatus,
  removeBugReport,
} from "@/lib/services/bug-reports.service";
import * as repo from "@/lib/repo/bug-reports.repo";

const mockRepo = repo as jest.Mocked<typeof repo>;

const REPORTER = {
  id: "u1",
  name: "Ada Reyes",
  email: "ada@example.com",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.insertBugReport.mockResolvedValue([{ id: "b1" }] as never);
  mockRepo.updateBugReport.mockResolvedValue([{ id: "b1" }] as never);
  mockRepo.deleteBugReport.mockResolvedValue([{ id: "b1" }] as never);
});

describe("createBugReport", () => {
  it("snapshots the reporter's name and email at write time", async () => {
    await createBugReport({ message: "Photos fail to upload", reporter: REPORTER });

    expect(mockRepo.insertBugReport).toHaveBeenCalledWith({
      message: "Photos fail to upload",
      reporter_id: "u1",
      reporter_name: "Ada Reyes",
      reporter_email: "ada@example.com",
    });
  });

  it("trims the message", async () => {
    await createBugReport({ message: "  spacey  ", reporter: REPORTER });

    expect(mockRepo.insertBugReport).toHaveBeenCalledWith(
      expect.objectContaining({ message: "spacey" }),
    );
  });

  it("tolerates a reporter with no profile name", async () => {
    await createBugReport({
      message: "x",
      reporter: { ...REPORTER, name: null },
    });

    expect(mockRepo.insertBugReport).toHaveBeenCalledWith(
      expect.objectContaining({ reporter_name: null }),
    );
  });

  it("rejects an empty message without touching the repo", async () => {
    await expect(
      createBugReport({ message: "   ", reporter: REPORTER }),
    ).rejects.toThrow(/empty/i);
    expect(mockRepo.insertBugReport).not.toHaveBeenCalled();
  });
});

describe("setBugReportStatus", () => {
  it("stamps resolved_at when resolving", async () => {
    await setBugReportStatus("b1", "Resolved");

    const [id, data] = mockRepo.updateBugReport.mock.calls[0];
    expect(id).toBe("b1");
    expect(data.status).toBe("Resolved");
    expect(data.resolved_at).toBeInstanceOf(Date);
  });

  it("clears resolved_at when reopening", async () => {
    await setBugReportStatus("b1", "Open");

    expect(mockRepo.updateBugReport).toHaveBeenCalledWith("b1", {
      status: "Open",
      resolved_at: null,
    });
  });

  it("throws when the report does not exist", async () => {
    mockRepo.updateBugReport.mockResolvedValue([] as never);

    await expect(setBugReportStatus("nope", "Resolved")).rejects.toThrow(
      /not found/i,
    );
  });
});

describe("removeBugReport", () => {
  it("throws when the report does not exist", async () => {
    mockRepo.deleteBugReport.mockResolvedValue([] as never);

    await expect(removeBugReport("nope")).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest __tests__/services/bug-reports.test.ts`
Expected: FAIL — cannot find module `@/lib/services/bug-reports.service`.

- [ ] **Step 3: Create `lib/services/bug-reports.service.ts`**

```ts
import * as bugReportsRepo from "@/lib/repo/bug-reports.repo";
import type { BugReportStatus } from "@/lib/db/enums";
import { AppError } from "@/lib/error/app-error";

export type Reporter = {
  id: string;
  name: string | null;
  email: string;
};

/**
 * Records a bug report, snapshotting who filed it.
 *
 * The reporter is passed in rather than read here: auth belongs to the action
 * layer. The snapshot is deliberate — see the bug_reports table comment.
 */
export const createBugReport = async ({
  message,
  reporter,
}: {
  message: string;
  reporter: Reporter;
}) => {
  const trimmed = message.trim();
  if (!trimmed) throw new AppError("A bug report cannot be empty.", 400);

  const [created] = await bugReportsRepo.insertBugReport({
    message: trimmed,
    reporter_id: reporter.id,
    reporter_name: reporter.name,
    reporter_email: reporter.email,
  });
  return created;
};

/**
 * Resolves or reopens a report. resolved_at tracks status rather than being set
 * independently, so a reopened report never keeps a stale resolution date.
 */
export const setBugReportStatus = async (
  id: string,
  status: BugReportStatus,
) => {
  const [updated] = await bugReportsRepo.updateBugReport(id, {
    status,
    resolved_at: status === "Resolved" ? new Date() : null,
  });
  if (!updated) throw new AppError("Bug report not found.", 404);
  return updated;
};

export const removeBugReport = async (id: string) => {
  const [deleted] = await bugReportsRepo.deleteBugReport(id);
  if (!deleted) throw new AppError("Bug report not found.", 404);
  return deleted;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm jest __tests__/services/bug-reports.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Full suite, type-check, lint**

Run: `pnpm jest __tests__ && pnpm tsc --noEmit && pnpm lint lib/services/bug-reports.service.ts`
Expected: all PASS, tsc exit 0, zero lint warnings.

- [ ] **Step 6: Commit**

```bash
git add lib/services/bug-reports.service.ts __tests__/services/bug-reports.test.ts
git commit -m "feat(bug-reports): service layer

createBugReport snapshots the reporter passed in by the action layer;
setBugReportStatus derives resolved_at from the status so a reopened report
never keeps a stale resolution date."
```

---

### Task 8: Submit form in the user dialog

**Files:**
- Create: `app/actions/bug-reports.ts`
- Modify: `components/app-pages/shared/user-details-dialog.tsx`

**Interfaces:**
- Consumes from Task 6: `createBugReportSchema`, `setBugReportStatusSchema`, `deleteBugReportSchema`
- Consumes from Task 7: `createBugReport`, `setBugReportStatus`, `removeBugReport`
- Produces, consumed by Task 9: `submitBugReport`, `listBugReports`, `resolveBugReport`, `removeBugReportAction` from `@/app/actions/bug-reports`

**Background:** `UserDetailsDialog` renders from `user-menu.tsx` in the shell, so every signed-in user reaches it — Volunteers included. The section keeps its heading and position; the button stops being an external link and expands the section **in place**. Do not open a second modal on top of the dialog: an error inside a stacked modal is exactly the defect P1's final review had to fix.

- [ ] **Step 1: Create `app/actions/bug-reports.ts`**

```ts
"use server";
import { z } from "zod";
import { actionClient } from "@/lib/error/actions-handler";
import * as service from "@/lib/services/bug-reports.service";
import * as bugReportsRepo from "@/lib/repo/bug-reports.repo";
import { requireAuth, requireRole, ADMIN_ONLY } from "@/lib/auth/rbac";
import {
  createBugReportSchema,
  setBugReportStatusSchema,
  deleteBugReportSchema,
} from "@/lib/validation/bug-reports";
import { BUG_REPORT_STATUS_VALUES } from "@/lib/db/enums";

/**
 * Any signed-in user may report a bug — Volunteers included. Identity comes
 * from the session, never from the payload, so a reporter cannot attribute a
 * report to someone else.
 */
export const submitBugReport = actionClient
  .schema(createBugReportSchema)
  .action(async ({ parsedInput }) => {
    const { user, profile } = await requireAuth();
    return await service.createBugReport({
      message: parsedInput.message,
      reporter: {
        id: profile.id,
        name: profile.name ?? null,
        email: user.email ?? "unknown",
      },
    });
  });

export const listBugReports = actionClient
  .schema(z.object({ status: z.enum(BUG_REPORT_STATUS_VALUES).optional() }))
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await bugReportsRepo.findBugReports({ status: parsedInput.status });
  });

export const resolveBugReport = actionClient
  .schema(setBugReportStatusSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.setBugReportStatus(parsedInput.id, parsedInput.status);
  });

export const removeBugReportAction = actionClient
  .schema(deleteBugReportSchema)
  .action(async ({ parsedInput }) => {
    await requireRole(...ADMIN_ONLY);
    return await service.removeBugReport(parsedInput.id);
  });
```

- [ ] **Step 2: Replace the bug-report section in `user-details-dialog.tsx`**

Delete the `const BUG_REPORT_URL = "https://github.com/legnspice/agila-app/issues";` line near the top. Add to the imports:

```tsx
import { useState, useTransition } from "react";
import { submitBugReport } from "@/app/actions/bug-reports";
```

Add this state inside the component:

```tsx
  const [reporting, setReporting] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
```

Replace the whole `<div className="mt-6 border-t border-border pt-5">…</div>` block — heading, copy and the `<a href={BUG_REPORT_URL}>` button — with:

```tsx
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-heading text-lg font-bold text-brand-green">
            Report a Bug
          </h3>

          {sent ? (
            <p className="mt-2 text-sm text-brand-dark/65">
              Thanks — your report was sent. An administrator will take a look.
            </p>
          ) : reporting ? (
            <>
              <p className="mt-1 text-sm text-brand-dark/65">
                Describe what went wrong. Your name and email are attached
                automatically.
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                autoFocus
                placeholder="What happened, and what were you doing at the time?"
                className="mt-2 w-full resize-y rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
              />
              {reportError && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {reportError}
                </p>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReporting(false);
                    setMessage("");
                    setReportError(null);
                  }}
                  className="rounded-full px-4 py-2 text-sm font-bold text-brand-dark/60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSending || !message.trim()}
                  onClick={() => {
                    setReportError(null);
                    startSending(async () => {
                      try {
                        const res = await submitBugReport({ message });
                        if (res?.serverError) throw new Error(res.serverError);
                        if (!res?.data) {
                          // Neither data nor serverError means zod rejected the
                          // payload; without this the click silently does
                          // nothing.
                          throw new Error(
                            "Please keep the report under 2000 characters.",
                          );
                        }
                        setSent(true);
                        setReporting(false);
                        setMessage("");
                      } catch (e) {
                        setReportError(
                          e instanceof Error
                            ? e.message
                            : "Could not send your report.",
                        );
                      }
                    });
                  }}
                  className="rounded-full bg-brand-orange px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {isSending ? "Sending…" : "Send report"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-brand-dark/65">Noticed an issue?</p>
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand-orange px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Report bug
              </button>
            </div>
          )}
        </div>
```

- [ ] **Step 3: Remove the now-unused icon import**

`ExternalLinkIcon` was used only by the deleted anchor. Remove it from this file's icons import if nothing else in the file uses it.

Run: `grep -n "ExternalLinkIcon" components/app-pages/shared/user-details-dialog.tsx`
Expected: no output. (`tsc` will not flag an unused import — `noUnusedLocals` is off — but eslint will.)

- [ ] **Step 4: Confirm the GitHub link is gone**

Run: `grep -rn "legnspice/agila-app" --include="*.tsx" --include="*.ts" app components lib`
Expected: no output.

- [ ] **Step 5: Type-check, lint, test**

Run: `pnpm tsc --noEmit && pnpm jest __tests__ && pnpm lint app/actions/bug-reports.ts components/app-pages/shared/user-details-dialog.tsx`
Expected: tsc exit 0, all suites PASS, zero lint warnings.

- [ ] **Step 6: Commit**

```bash
git add app/actions/bug-reports.ts components/app-pages/shared/user-details-dialog.tsx
git commit -m "feat(bug-reports): in-app report form replaces the GitHub link

The old link pointed at a personal repo and required a GitHub account, so the
volunteers who actually hit bugs could not use it. The dialog section now
expands in place into a form — no stacked modal — and identity is read from
the session rather than the payload."
```

---

### Task 9: Admin card and triage subroute

**Files:**
- Modify: `app/(protected)/dashboard/admin/page.tsx`
- Modify: `components/app-pages/admin/admin-screen.tsx`
- Create: `app/(protected)/dashboard/admin/bug-reports/page.tsx`
- Create: `app/(protected)/dashboard/admin/bug-reports/loading.tsx`
- Create: `components/app-pages/admin/bug-reports-screen.tsx`

**Interfaces:**
- Consumes from Task 6: `findBugReports`, `countOpenBugReports`, type `BugReport`
- Consumes from Task 8: `listBugReports`, `resolveBugReport`, `removeBugReportAction`
- Produces: `AdminScreen` gains `openBugReports: number`

**Background:** `app/(protected)/dashboard/admin/layout.tsx` already redirects non-Administrators, so every route under `/dashboard/admin/*` is Administrator-only for free. The actions still re-check server-side — client gating is never sufficient.

Subroutes in this codebase use a `Back ‹` pill: `<Link href={…} className="rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90">Back <span className="ml-1">&#8249;</span></Link>`.

- [ ] **Step 1: Seed the open count in `admin/page.tsx`**

Add `import { countOpenBugReports } from "@/lib/repo/bug-reports.repo";`. Extend the `Promise.all` (which after Task 5 destructures `[users, syncStatus, regions, links]`) with a fifth entry:

```tsx
    loadData("Open bug report count", () => countOpenBugReports(), 0),
```

destructure it as `openBugReports`, and pass `openBugReports={openBugReports}` to `<AdminScreen …>`.

- [ ] **Step 2: Add the card to `admin-screen.tsx`**

Add `import Link from "next/link";` if absent. Add `openBugReports: number;` to `AdminScreenProps` and destructure it. Define this component above `AdminScreen`:

```tsx
function BugReportsCard({ openCount }: { openCount: number }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-brand-dark">Bug Reports</h2>
      <div className="rounded-2xl bg-white ring-1 ring-border">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm text-brand-dark/65">
            {openCount === 0
              ? "No open reports."
              : `${openCount} open report${openCount === 1 ? "" : "s"}.`}
          </p>
          <Link
            href="/dashboard/admin/bug-reports"
            className="shrink-0 rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            View reports ›
          </Link>
        </div>
      </div>
    </div>
  );
}
```

Render `<BugReportsCard openCount={openBugReports} />` in **both** branches, immediately after `<LinkControls initialLinks={initialLinks} />` in each.

- [ ] **Step 3: Create the screen `components/app-pages/admin/bug-reports-screen.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  listBugReports,
  resolveBugReport,
  removeBugReportAction,
} from "@/app/actions/bug-reports";
import type { BugReport } from "@/lib/repo/bug-reports.repo";

type Filter = "Open" | "Resolved" | "All";

const FILTERS: Filter[] = ["Open", "Resolved", "All"];

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export function BugReportsScreen({
  initialReports,
}: {
  initialReports: BugReport[];
}) {
  const [reports, setReports] = useState<BugReport[]>(initialReports);
  const [filter, setFilter] = useState<Filter>("Open");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BugReport | null>(null);
  const [typed, setTyped] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        const res = await listBugReports({});
        if (res?.serverError) throw new Error(res.serverError);
        if (res?.data) setReports(res.data as BugReport[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  const visible = reports.filter((r) =>
    filter === "All" ? true : r.status === filter,
  );

  const body = (
    <>
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              filter === f
                ? "bg-brand-dark text-white"
                : "bg-white text-brand-dark/60 ring-1 ring-border hover:text-brand-dark"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="mt-3 space-y-3">
        {visible.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-brand-dark/50 ring-1 ring-border">
            No {filter === "All" ? "" : filter.toLowerCase()} reports.
          </p>
        ) : (
          visible.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl bg-white p-4 ring-1 ring-border"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-dark">
                    {r.reporter_name ?? "Unknown reporter"}
                  </p>
                  <p className="truncate text-xs text-brand-dark/50">
                    {r.reporter_email}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    r.status === "Open"
                      ? "bg-brand-orange/15 text-brand-orange"
                      : "bg-brand-mint text-brand-dark/60"
                  }`}
                >
                  {r.status}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-brand-dark/80">
                {r.message}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-brand-dark/45">
                  Reported {formatDate(r.created_at)}
                  {r.resolved_at
                    ? ` · Resolved ${formatDate(r.resolved_at)}`
                    : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      run(async () => {
                        const res = await resolveBugReport({
                          id: r.id,
                          status: r.status === "Open" ? "Resolved" : "Open",
                        });
                        if (res?.serverError)
                          throw new Error(res.serverError);
                      })
                    }
                    className="rounded-full bg-brand-dark px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {r.status === "Open" ? "Resolve" : "Reopen"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setConfirmDelete(r);
                      setTyped("");
                      setError(null);
                    }}
                    className="rounded-full px-3 py-1.5 text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-heading text-xl font-bold text-brand-dark">
              Bug Reports
            </p>
            <Link
              href="/dashboard/admin"
              className="rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
          {body}
        </div>
      </div>

      {/* ── Desktop ────────────────────────────────────────────────── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="font-heading text-2xl font-bold text-brand-dark">
              Bug Reports
            </h1>
            <Link
              href="/dashboard/admin"
              className="rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
          {body}
        </div>
      </div>

      {/* Delete confirm — typed confirmation, deletion is unrecoverable */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-brand-cream p-5 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-brand-dark">
              Delete report?
            </h3>
            <p className="mt-2 text-sm text-red-600">
              This permanently deletes the report from{" "}
              <strong>{confirmDelete.reporter_email}</strong>. This cannot be
              undone.
            </p>
            <p className="mt-3 text-xs text-brand-dark/60">
              Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
            />
            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-full px-4 py-2 text-sm font-bold text-brand-dark/60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || typed !== "DELETE"}
                onClick={() =>
                  run(async () => {
                    const res = await removeBugReportAction({
                      id: confirmDelete.id,
                    });
                    if (res?.serverError) throw new Error(res.serverError);
                    setConfirmDelete(null);
                  })
                }
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

Note the error renders **inside** the delete modal as well as in the page body — an error raised while a modal is open must not land behind its scrim.

- [ ] **Step 4: Create `app/(protected)/dashboard/admin/bug-reports/page.tsx`**

```tsx
import type { Metadata } from "next";
import { BugReportsScreen } from "@/components/app-pages/admin/bug-reports-screen";
import { findBugReports } from "@/lib/repo/bug-reports.repo";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = { title: "Admin — Bug Reports" };

export default async function BugReportsPage() {
  const reports = await loadData(
    "Bug reports initial load",
    () => findBugReports({}),
    [],
  );

  return <BugReportsScreen initialReports={reports} />;
}
```

- [ ] **Step 5: Create `app/(protected)/dashboard/admin/bug-reports/loading.tsx`**

```tsx
function Bone({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-full bg-stone-200 ${className}`} />
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-border">
      <Bone className="h-3.5 w-40" />
      <Bone className="h-2.5 w-52" />
      <Bone className="h-2.5 w-full" />
      <Bone className="h-2.5 w-3/4" />
    </div>
  );
}

export default function Loading() {
  return (
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <Bone className="h-6 w-36" />
            <Bone className="h-8 w-20" />
          </div>
          <div className="space-y-3">
            <ReportSkeleton />
            <ReportSkeleton />
            <ReportSkeleton />
          </div>
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <Bone className="h-8 w-44" />
            <Bone className="h-8 w-20" />
          </div>
          <div className="space-y-3">
            <ReportSkeleton />
            <ReportSkeleton />
            <ReportSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Confirm the card renders in both branches**

Run: `grep -c "BugReportsCard openCount" components/app-pages/admin/admin-screen.tsx`
Expected: `2`.

- [ ] **Step 7: Confirm no `min-h-screen` crept in**

Run: `grep -rn "min-h-screen" --include="*.tsx" app components`
Expected: no output. P1 removed the last one; the new screen and skeleton must use `flex flex-1 flex-col` on mobile, matching every other screen.

- [ ] **Step 8: Type-check, lint, test**

Run: `pnpm tsc --noEmit && pnpm jest __tests__ && pnpm lint components/app-pages/admin/bug-reports-screen.tsx components/app-pages/admin/admin-screen.tsx "app/(protected)/dashboard/admin/page.tsx" "app/(protected)/dashboard/admin/bug-reports/page.tsx" "app/(protected)/dashboard/admin/bug-reports/loading.tsx"`
Expected: tsc exit 0, all suites PASS, zero lint warnings.

- [ ] **Step 9: Commit**

```bash
git add components/app-pages/admin/bug-reports-screen.tsx components/app-pages/admin/admin-screen.tsx "app/(protected)/dashboard/admin/page.tsx" "app/(protected)/dashboard/admin/bug-reports/page.tsx" "app/(protected)/dashboard/admin/bug-reports/loading.tsx"
git commit -m "feat(admin): bug report triage subroute

Adds an open-count card on the Admin screen linking to
/dashboard/admin/bug-reports, which lists reports newest-first with an
Open/Resolved/All filter, resolve/reopen, and a typed-confirm delete. The
existing admin layout gate makes the route Administrator-only."
```

---

## Final Verification

After all nine tasks:

- [ ] `pnpm jest __tests__` — all suites pass (21 expected: 19 existing + `links.test.ts` + `bug-reports.test.ts`)
- [ ] `pnpm tsc --noEmit` — exit 0
- [ ] `pnpm build` — succeeds
- [ ] `grep -rn "CENSUS_REPORT_URL\|REFERRAL_SHEET_URL\|ADOPT_FOSTER_APPLICATION_URL" --include="*.tsx" components app` — only `app/error.tsx` matches (the crash boundary, deliberately)
- [ ] `grep -rn "legnspice/agila-app" --include="*.ts" --include="*.tsx" app components lib` — no output
- [ ] `grep -rn "min-h-screen" --include="*.tsx" app components` — no output
- [ ] `pnpm lint` — no NEW problems beyond the 2 errors / 3 warnings pre-existing in `reverse-sync.service.ts`, `find-suffix-drift.ts`, `workers/sync-cron/src/index.ts`

Manual:

- [ ] Edit each link in Admin → every consumer screen picks up the new value
- [ ] Clear a link → it falls back to the built-in default rather than rendering empty
- [ ] Enter a non-URL → validation rejects it, error shows in the card
- [ ] Sign in as a Volunteer → submit a bug report → confirmation appears in the dialog
- [ ] As an Administrator → the report appears with the right name and email; the Admin card count is correct
- [ ] Resolve, reopen, then delete it → the filter and the open count track each change
- [ ] Delete a user who filed a report → the report survives and still shows their email
- [ ] Bug Reports screen on a phone → single scroll, bottom nav not overlapped, skeleton does not jump

## Out of Scope (recorded, not tasks)

- **Fixing the pre-existing `db.*` layering violations** in `system.service.ts` (sync-freeze functions), `photo-import.service.ts`, `sync-cron.service.ts`, `reverse-sync.service.ts` and `helper.service.ts`. New code in this plan follows the rule; the existing calls stay.
- **Correcting `CLAUDE.md`**, which claims services never call `db.*` and that this "holds everywhere today". That is inaccurate — five services violate it.
- Notifying admins when a report arrives.
- Reporter-visible status.
- Attachments or screenshots on reports.
- Rate limiting (sign-in is an admin-managed allowlist of ~40 people).
- Pagination on the bug reports list. Add it if volume ever warrants; the filter carries the load until then.
