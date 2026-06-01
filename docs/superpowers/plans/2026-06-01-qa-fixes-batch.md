# QA Fixes Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve 17 QA issues (stats correctness, responsiveness, auth, public catalog, shared components, sessions/users tables, modal redesign) from the frontend review.

**Architecture:** Census stat logic (currently inline in Overview and TNVR screens) is extracted to a shared, unit-testable `lib/stats/census-stats.ts` module so Overview, TNVR, and charts share one consistent definition of "active census" and neuter status (driven by the `is_neutered` flag, not `neuter_date`). A shared `<BrandLogo>` component replaces four duplicated logo lockups. Remaining items are targeted UI/layout edits. Pure logic is covered by Jest tests (TDD); visual/layout changes are verified with `pnpm tsc --noEmit` and `pnpm build`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4 (`@theme inline`), Drizzle, Supabase SSR, Jest.

**Conventions (from CLAUDE.md):**

- Use **pnpm** only. Type-check with `pnpm tsc --noEmit`.
- Do not run `pnpm dev` to verify. Trust the code + type-check/build.
- Never hardcode hex in components — use brand tokens / Tailwind classes.
- Avoid setState patterns that trigger cascading-render lint errors.
- Mobile = baseline (layout may change); desktop = colors/fonts/responsive tweaks.

**Commit after every task.** Branch: `dev` (already current).

---

## File Structure

**Create:**

- `lib/stats/census-stats.ts` — shared census/TNVR stat computation (pure functions).
- `__tests__/stats/census-stats.test.ts` — unit tests for the above.
- `components/app-pages/shared/brand-logo.tsx` — shared logo lockup (Link → `/`).

**Modify:**

- `components/app-pages/overview/overview-screen.tsx` (#1, #9, #13, #14)
- `components/app-pages/tnvr/tnvr-screen.tsx` (#9, #13)
- `lib/hooks/filter-sort-configs.ts` (#4)
- `components/app-pages/catalog/catalog-screen.tsx` (#4)
- `app/(public)/layout.tsx` (#3, #5)
- `app/(protected)/dashboard/layout.tsx` (#5)
- `app/(auth)/login/page.tsx` (#5, #6, #8)
- `app/auth/callback/route.ts` (#6)
- `components/app-pages/users/user-dialogs.tsx` (#6)
- `components/app-pages/shared/icons.tsx` (#3)
- `components/app-pages/shared/cat-card.tsx` (#10, #15)
- `components/app-pages/database/database-list-screen.tsx` (#2, #11, #15)
- `components/app-pages/sessions/sessions-screen.tsx` (#12)
- `components/app-pages/users/users-screen.tsx` (#16)
- `components/app-pages/shared/user-details-dialog.tsx` (#17)
- `app/globals.css` (#10 status tokens)

**Delete:**

- `app/(auth)/login/non-ateneo-email-used/page.tsx` (#6)

---

## Phase A — Census stats core (#1, #9, #13)

### Task 1: Extract + fix census stats into a tested module

**Files:**

- Create: `lib/stats/census-stats.ts`
- Test: `__tests__/stats/census-stats.test.ts`

This module centralizes the logic from `overview-screen.tsx` (`computeStats`) and `tnvr-screen.tsx` (`computeTnvrStats`), applying two corrections: **active census** (`total` excludes off-census statuses) and **neuter via `is_neutered === true`** (not `neuter_date`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/stats/census-stats.test.ts`:

```ts
import {
  OFF_CENSUS_STATUSES,
  isActiveCensus,
  computeCensusStats,
  computeTnvrStats,
} from "@/lib/stats/census-stats";
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";

function cat(p: Partial<SelectCat>): SelectCat {
  return {
    id: p.id ?? "c1",
    name: p.name ?? "Tom",
    sex: p.sex ?? "Male",
    color: p.color ?? null,
    age: p.age ?? null,
    sociability: p.sociability ?? null,
    spot_last_seen: p.spot_last_seen ?? null,
    last_updated_at: p.last_updated_at ?? null,
    photo_url: p.photo_url ?? null,
    cat_status: p.cat_status ?? null,
    is_adoptable: p.is_adoptable ?? false,
    entry_status: p.entry_status ?? "Original",
  } as SelectCat;
}

function hr(p: Partial<SelectCatHealthRecord>): SelectCatHealthRecord {
  return {
    cat_id: p.cat_id ?? "c1",
    is_neutered: p.is_neutered ?? null,
    neuter_date: p.neuter_date ?? null,
    condition: p.condition ?? null,
  } as SelectCatHealthRecord;
}

describe("isActiveCensus", () => {
  it("treats null-status Original cats as active", () => {
    expect(isActiveCensus(cat({ cat_status: null }))).toBe(true);
  });
  it("excludes off-census statuses", () => {
    for (const s of OFF_CENSUS_STATUSES) {
      expect(isActiveCensus(cat({ cat_status: s }))).toBe(false);
    }
  });
  it("excludes non-Original entries", () => {
    expect(isActiveCensus(cat({ entry_status: "Duplicate" as never }))).toBe(
      false,
    );
  });
});

describe("computeCensusStats", () => {
  it("total counts only active census; overall = active + off-census, no double count", () => {
    const cats = [
      cat({ id: "a", cat_status: null }),
      cat({ id: "b", cat_status: null }),
      cat({ id: "c", cat_status: "Adopted" }),
      cat({ id: "d", cat_status: "Deceased" }),
    ];
    const s = computeCensusStats(cats, []);
    expect(s.total).toBe(2);
    expect(s.offCensusTotal).toBe(2);
    expect(s.overallTotal).toBe(4);
  });

  it("counts neutered by is_neutered flag, ignoring neuter_date", () => {
    const cats = [
      cat({ id: "a", cat_status: null }),
      cat({ id: "b", cat_status: null }),
    ];
    const records = [
      hr({ cat_id: "a", is_neutered: true, neuter_date: null }),
      hr({ cat_id: "b", is_neutered: false, neuter_date: new Date() }),
    ];
    const s = computeCensusStats(cats, records);
    expect(s.neutered).toBe(1);
    expect(s.unneutered).toBe(1);
  });
});

describe("computeTnvrStats", () => {
  it("uses active census denominator and is_neutered flag", () => {
    const cats = [
      cat({ id: "a", sex: "Male", cat_status: null }),
      cat({ id: "b", sex: "Female", cat_status: null }),
      cat({ id: "c", sex: "Male", cat_status: "Adopted" }), // off-census, excluded
    ];
    const records = [hr({ cat_id: "a", is_neutered: true })];
    const s = computeTnvrStats(cats, records);
    expect(s.total).toBe(2);
    expect(s.neuteredMale).toBe(1);
    expect(s.totalMale).toBe(1);
    expect(s.overallTnvr).toBe("50%");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest __tests__/stats/census-stats.test.ts`
Expected: FAIL — `Cannot find module '@/lib/stats/census-stats'`.

- [ ] **Step 3: Write the module**

Create `lib/stats/census-stats.ts`:

```ts
import type { SelectCat, SelectCatHealthRecord } from "@/lib/validation/cats";

/** Statuses that move a cat off the active census. */
export const OFF_CENSUS_STATUSES = [
  "Fostered",
  "Adopted",
  "MIA",
  "Deceased",
] as const;

const OFF_CENSUS_SET = new Set<string>(OFF_CENSUS_STATUSES);

/** Active census = Original entry AND not an off-census status. */
export function isActiveCensus(cat: SelectCat): boolean {
  if (cat.entry_status !== "Original") return false;
  return !(cat.cat_status && OFF_CENSUS_SET.has(cat.cat_status));
}

function hrMap(records: SelectCatHealthRecord[]) {
  const m = new Map<string, SelectCatHealthRecord>();
  for (const hr of records) m.set(hr.cat_id, hr);
  return m;
}

export type CensusStats = {
  total: number;
  neutered: number;
  unneutered: number;
  tnvrPct: number;
  domesticated: number;
  tame: number;
  feral: number;
  sick: number;
  injured: number;
  adoptable: number;
  unnamed: number;
  fostered: number;
  adopted: number;
  mia: number;
  deceased: number;
  offCensusTotal: number;
  overallTotal: number;
};

export function computeCensusStats(
  cats: SelectCat[],
  healthRecords: SelectCatHealthRecord[],
): CensusStats {
  const hr = hrMap(healthRecords);
  const original = cats.filter((c) => c.entry_status === "Original");
  const active = original.filter(isActiveCensus);

  let neutered = 0;
  let domesticated = 0;
  let tame = 0;
  let feral = 0;
  let sick = 0;
  let injured = 0;
  let adoptable = 0;
  let unnamed = 0;

  for (const cat of active) {
    const rec = hr.get(cat.id);
    if (rec?.is_neutered === true) neutered++;
    if (cat.sociability === "Domesticated") domesticated++;
    else if (cat.sociability === "Tame") tame++;
    else if (cat.sociability === "Feral") feral++;
    if (rec?.condition === "Sick" || rec?.condition === "Sick and Injured")
      sick++;
    if (rec?.condition === "Injured" || rec?.condition === "Sick and Injured")
      injured++;
    if (cat.is_adoptable) adoptable++;
    if (!cat.name || cat.name.trim() === "") unnamed++;
  }

  let fostered = 0;
  let adopted = 0;
  let mia = 0;
  let deceased = 0;
  for (const cat of original) {
    if (cat.cat_status === "Fostered") fostered++;
    else if (cat.cat_status === "Adopted") adopted++;
    else if (cat.cat_status === "MIA") mia++;
    else if (cat.cat_status === "Deceased") deceased++;
  }

  const total = active.length;
  const unneutered = total - neutered;
  const tnvrPct = total > 0 ? Math.round((neutered / total) * 100) : 0;
  const offCensusTotal = fostered + adopted + mia + deceased;
  const overallTotal = total + offCensusTotal;

  return {
    total,
    neutered,
    unneutered,
    tnvrPct,
    domesticated,
    tame,
    feral,
    sick,
    injured,
    adoptable,
    unnamed,
    fostered,
    adopted,
    mia,
    deceased,
    offCensusTotal,
    overallTotal,
  };
}

export type TnvrStats = {
  neuteredMale: number;
  spayedFemale: number;
  neuteredUnknown: number;
  unneuteredMale: number;
  unneuteredFemale: number;
  unneuteredUnknown: number;
  totalNeutered: number;
  totalUnneutered: number;
  total: number;
  totalMale: number;
  totalFemale: number;
  totalUnknown: number;
  overallTnvr: string;
  maleTnvr: string;
  femaleTnvr: string;
  unknownTnvr: string;
};

export function computeTnvrStats(
  cats: SelectCat[],
  healthRecords: SelectCatHealthRecord[],
): TnvrStats {
  const hr = hrMap(healthRecords);
  const active = cats.filter(isActiveCensus);

  let neuteredMale = 0;
  let spayedFemale = 0;
  let neuteredUnknown = 0;
  let unneuteredMale = 0;
  let unneuteredFemale = 0;
  let unneuteredUnknown = 0;
  let totalMale = 0;
  let totalFemale = 0;
  let totalUnknown = 0;

  for (const cat of active) {
    const rec = hr.get(cat.id);
    const isNeutered = rec?.is_neutered === true;
    if (cat.sex === "Male") {
      totalMale++;
      isNeutered ? neuteredMale++ : unneuteredMale++;
    } else if (cat.sex === "Female") {
      totalFemale++;
      isNeutered ? spayedFemale++ : unneuteredFemale++;
    } else {
      totalUnknown++;
      isNeutered ? neuteredUnknown++ : unneuteredUnknown++;
    }
  }

  const totalNeutered = neuteredMale + spayedFemale + neuteredUnknown;
  const totalUnneutered = unneuteredMale + unneuteredFemale + unneuteredUnknown;
  const total = active.length;
  const pct = (n: number, d: number) =>
    d > 0 ? `${Math.round((n / d) * 100)}%` : "0%";

  return {
    neuteredMale,
    spayedFemale,
    neuteredUnknown,
    unneuteredMale,
    unneuteredFemale,
    unneuteredUnknown,
    totalNeutered,
    totalUnneutered,
    total,
    totalMale,
    totalFemale,
    totalUnknown,
    overallTnvr: pct(totalNeutered, total),
    maleTnvr: pct(neuteredMale, totalMale),
    femaleTnvr: pct(spayedFemale, totalFemale),
    unknownTnvr: pct(neuteredUnknown, totalUnknown),
  };
}
```

> Note: the ternary-as-statement lines (`isNeutered ? a++ : b++`) may trip the eslint `no-unused-expressions` rule. If `pnpm tsc`/lint complains, convert to `if (isNeutered) a++; else b++;`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest __tests__/stats/census-stats.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add lib/stats/census-stats.ts __tests__/stats/census-stats.test.ts
git commit -m "feat(stats): shared active-census stats module using is_neutered flag"
```

---

### Task 2: Wire Overview screen to shared stats (#1, #9, #13)

**Files:**

- Modify: `components/app-pages/overview/overview-screen.tsx`

- [ ] **Step 1: Replace the inline computeStats**

Delete the local `function computeStats(...) { ... }` block. Add an import at the top (with the other imports):

```ts
import { computeCensusStats } from "@/lib/stats/census-stats";
```

- [ ] **Step 2: Update both `useMemo` call sites**

Replace `computeStats(filteredCats, allHealthRecords)` with `computeCensusStats(filteredCats, allHealthRecords)` and `computeStats(desktopCats, allHealthRecords)` with `computeCensusStats(desktopCats, allHealthRecords)`. All downstream property names (`stats.total`, `stats.neutered`, `stats.offCensusTotal`, `stats.overallTotal`, etc.) are unchanged — `CensusStats` keeps the same shape.

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/app-pages/overview/overview-screen.tsx
git commit -m "fix(overview): use shared active-census stats (no double count, is_neutered)"
```

---

### Task 3: Wire TNVR screen to shared stats (#9, #13)

**Files:**

- Modify: `components/app-pages/tnvr/tnvr-screen.tsx`

- [ ] **Step 1: Replace inline computeTnvrStats**

Delete the local `function computeTnvrStats(...) { ... }` block. Add import:

```ts
import { computeTnvrStats } from "@/lib/stats/census-stats";
```

The existing call sites (`computeTnvrStats(mobileCats, allHealthRecords)`, `computeTnvrStats(desktopCats, allHealthRecords)`) and all consumed properties stay identical — only the source and the active-census + `is_neutered` semantics change.

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/app-pages/tnvr/tnvr-screen.tsx
git commit -m "fix(tnvr): use shared active-census stats + is_neutered flag"
```

---

## Phase B — Stats responsiveness (#14)

### Task 4: Fix Overview desktop responsiveness + sociability alignment

**Files:**

- Modify: `components/app-pages/overview/overview-screen.tsx` (desktop block, `tablet:block`)

- [ ] **Step 1: Make primary stat numbers responsive**

In the desktop "Primary stats — green hero row", change the value paragraph class from:

```
className="mt-1 font-heading text-4xl font-bold leading-none tabular-nums text-white"
```

to:

```
className="mt-1 font-heading text-2xl font-bold leading-none tabular-nums text-white lg:text-3xl xl:text-4xl"
```

- [ ] **Step 2: Fix the status stat strip grid + cell alignment**

The status strip currently uses `grid-cols-6` and cells `flex items-center justify-between … py-2.5` that wrap labels. Change the grid wrapper to:

```
className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
```

And each cell to prevent label wrap and keep the number aligned:

```
className="flex items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-border"
```

- On the label span add `whitespace-nowrap`:

```
className="whitespace-nowrap text-xs font-semibold text-brand-dark/70"
```

- On the value span keep `font-heading text-base font-bold tabular-nums text-brand-dark shrink-0`.

- [ ] **Step 3: Make off-census parity row responsive**

Change the off-census `grid-cols-6` to `grid-cols-2 sm:grid-cols-3 xl:grid-cols-6`, and the `col-span-2` hero card to `col-span-2 xl:col-span-2` (stays 2 wide). Step the big number `text-3xl` → `text-2xl lg:text-3xl`.

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/app-pages/overview/overview-screen.tsx
git commit -m "fix(overview): responsive desktop grids + nowrap stat cells at lg"
```

---

## Phase C — Public catalog & shared chrome (#4, #5, #3)

### Task 5: Public catalog filter config (#4)

**Files:**

- Modify: `lib/hooks/filter-sort-configs.ts`
- Modify: `components/app-pages/catalog/catalog-screen.tsx`

- [ ] **Step 1: Add `PUBLIC_CATALOG_CONFIG`**

In `lib/hooks/filter-sort-configs.ts`, after `DATABASE_LIST_CONFIG`, add:

```ts
export const PUBLIC_CATALOG_CONFIG: FilterSortConfig = {
  filters: [
    { label: "Region", key: "region_name", options: REGION_FILTER_OPTIONS },
    { label: "Color", key: "color", options: [...CAT_COLOR_VALUES, "Unknown"] },
    { label: "Age", key: "age", options: [...CAT_AGE_VALUES, "Unknown"] },
    { label: "Sex", key: "sex", options: [...CAT_SEX_VALUES, "Unknown"] },
    {
      label: "Sociability",
      key: "sociability",
      options: [...CAT_SOCIABILITY_VALUES, "Unknown"],
    },
  ],
  sortOptions: [
    { label: "Name", key: "name" },
    { label: "Age", key: "age" },
    { label: "Sex", key: "sex" },
    { label: "Color", key: "color" },
    { label: "Last Updated", key: "last_updated_at" },
  ],
};
```

- [ ] **Step 2: Point catalog screen at it**

In `components/app-pages/catalog/catalog-screen.tsx`, change the import `DATABASE_LIST_CONFIG` → `PUBLIC_CATALOG_CONFIG` and the `useFilterSort(cats, DATABASE_LIST_CONFIG, ...)` argument to `PUBLIC_CATALOG_CONFIG`.

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/filter-sort-configs.ts components/app-pages/catalog/catalog-screen.tsx
git commit -m "fix(catalog): public filters limited to region/color/age/sex/sociability"
```

---

### Task 6: Shared `<BrandLogo>` component (#5)

**Files:**

- Create: `components/app-pages/shared/brand-logo.tsx`
- Modify: `app/(public)/layout.tsx`, `app/(protected)/dashboard/layout.tsx`, `app/(auth)/login/page.tsx`

- [ ] **Step 1: Create the component**

Create `components/app-pages/shared/brand-logo.tsx`:

```tsx
import Link from "next/link";

function PawIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <ellipse cx="5" cy="9" rx="2" ry="3" />
      <ellipse cx="10" cy="6.5" rx="2" ry="3" />
      <ellipse cx="14" cy="6.5" rx="2" ry="3" />
      <ellipse cx="19" cy="9" rx="2" ry="3" />
      <path d="M12 12c-3.5 0-7 2.5-6.5 6.5.3 2 2 3.5 4 3.5h5c2 0 3.7-1.5 4-3.5C19 14.5 15.5 12 12 12z" />
    </svg>
  );
}

type BrandLogoProps = {
  /** `boxed` = paw in a rounded square (sidebar/login); `inline` = bare paw (headers). */
  variant?: "inline" | "boxed";
  /** Eyebrow line above CATALOG. Defaults to "AGILA". */
  eyebrow?: string;
  /** Link target; defaults to the public catalog. */
  href?: string;
  className?: string;
};

export function BrandLogo({
  variant = "inline",
  eyebrow = "AGILA",
  href = "/",
  className = "",
}: BrandLogoProps) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 ${className}`}>
      {variant === "boxed" ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green">
          <PawIcon className="h-6 w-6 text-white" />
        </span>
      ) : (
        <PawIcon className="h-7 w-7 text-white" />
      )}
      <span>
        <span className="block text-[8px] font-semibold uppercase tracking-widest text-white/60">
          {eyebrow}
        </span>
        <span className="block font-brand text-base leading-tight tracking-wider text-white">
          CATALOG
        </span>
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Replace public header logo**

In `app/(public)/layout.tsx`: delete the local `PawIcon` function and the `<Link href="/"> … </Link>` logo lockup; import and render `<BrandLogo />`. Keep the header `<a>` Apply button for now (it's replaced in Task 7).

```tsx
import { BrandLogo } from "@/components/app-pages/shared/brand-logo";
// ...inside header, left side:
<BrandLogo />;
```

- [ ] **Step 3: Replace dashboard logos**

In `app/(protected)/dashboard/layout.tsx`: delete the local `PawIcon`; replace the mobile-header lockup (around L173) with `<BrandLogo />` and the sidebar lockup (around L233) with `<BrandLogo variant="boxed" />`. Add the import.

- [ ] **Step 4: Replace login-page brand lockup**

In `app/(auth)/login/page.tsx`: the brand panel lockup (the `bg-brand-dark` boxed paw + "Ateneo de Manila / AGILA CATALOG"). Replace the inner lockup with `<BrandLogo variant="boxed" eyebrow="AGILA" />`. Leave the decorative absolute `PawIcon`s (they need the local helper) — so keep the local `PawIcon` in login page, only swap the clickable lockup.

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/app-pages/shared/brand-logo.tsx "app/(public)/layout.tsx" "app/(protected)/dashboard/layout.tsx" "app/(auth)/login/page.tsx"
git commit -m "feat(shared): BrandLogo component; all logos link to catalog"
```

---

### Task 7: Homepage Login/Dashboard header button (#3)

**Files:**

- Modify: `components/app-pages/shared/icons.tsx`
- Modify: `app/(public)/layout.tsx`

- [ ] **Step 1: Add two icons**

In `components/app-pages/shared/icons.tsx`, add (following the existing `IconProps` pattern):

```tsx
export function LogInIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
```

- [ ] **Step 2: Make the public layout auth-aware**

`app/(public)/layout.tsx` is a server component. Add session check and swap the header button. Replace the `Apply` `<a>` with:

```tsx
import { createClient } from "@/lib/supabase/server";
import { LogInIcon, DashboardIcon } from "@/components/app-pages/shared/icons";
// remove ExternalLinkIcon + ADOPT_FOSTER_APPLICATION_URL imports if now unused

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isAuthed = !!data?.user;

  // ...in header, right side:
  isAuthed ? (
    <Link
      href="/dashboard/overview"
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-brand-green px-4 text-xs font-bold text-white transition-opacity hover:opacity-90"
    >
      Dashboard <DashboardIcon className="h-3.5 w-3.5" />
    </Link>
  ) : (
    <Link
      href="/login"
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-brand-green px-4 text-xs font-bold text-white transition-opacity hover:opacity-90"
    >
      Login <LogInIcon className="h-3.5 w-3.5" />
    </Link>
  )
```

Make sure `PublicLayout` is `async` and the JSX is wired with the `{isAuthed ? ... : ...}` expression in the header's right slot.

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/app-pages/shared/icons.tsx "app/(public)/layout.tsx"
git commit -m "feat(public): green Login/Dashboard header button based on auth"
```

---

## Phase D — Auth (#6, #8)

### Task 8: Remove the @ateneo domain restriction (#6)

**Files:**

- Modify: `app/auth/callback/route.ts`
- Modify: `components/app-pages/users/user-dialogs.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Delete: `app/(auth)/login/non-ateneo-email-used/page.tsx`

- [ ] **Step 1: Remove the domain gate in the callback**

In `app/auth/callback/route.ts`, delete the entire block from the `// Domain restriction check` comment through the closing `}` of the `if (!isAteneo) { ... }` (the `isAteneo` computation and its early-return to `/login/non-ateneo-email-used`). Leave the allowlist (`findAllowedEmails`) check and everything after intact.

- [ ] **Step 2: Relax the add-user form copy**

In `components/app-pages/users/user-dialogs.tsx` (~L187), change `label="Ateneo Email Address"` → `label="Email Address"` and `placeholder="user@student.ateneo.edu"` → `placeholder="user@example.com"`. Confirm there is no validation rejecting non-ateneo emails; if a regex/check exists, remove it (server `addUser` action validates email format only).

- [ ] **Step 3: Update login copy**

In `app/(auth)/login/page.tsx` (~L81), change "Use your Ateneo Google account to manage the catalog." → "Use your Google account to manage the catalog."

- [ ] **Step 4: Delete the dead route**

```bash
git rm "app/(auth)/login/non-ateneo-email-used/page.tsx"
```

Then grep to confirm nothing else references it:

Run: `pnpm exec grep -rn "non-ateneo-email-used" app components lib` (expect: no matches)

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/auth/callback/route.ts" components/app-pages/users/user-dialogs.tsx "app/(auth)/login/page.tsx"
git commit -m "feat(auth): drop @ateneo domain gate; rely on allowlist"
```

---

### Task 9: Remove "Secured access" caption (#8)

**Files:**

- Modify: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace the captioned separator**

Replace the three-part separator block:

```tsx
<div className="my-6 flex items-center gap-3">
  <span className="h-px flex-1 bg-brand-dark/10" />
  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-dark/40">
    Secured access
  </span>
  <span className="h-px flex-1 bg-brand-dark/10" />
</div>
```

with a single divider:

```tsx
<div className="my-6 h-px w-full bg-brand-dark/10" />
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/login/page.tsx"
git commit -m "fix(login): remove Secured access caption, keep divider"
```

---

## Phase E — Cards, badges, database (#10, #2, #15, #11)

### Task 10: Distinct status badge colors (#10)

**Files:**

- Modify: `app/globals.css`
- Modify: `components/app-pages/shared/cat-card.tsx`

- [ ] **Step 1: Add status tokens**

In `app/globals.css`, inside the `@theme inline { ... }` block (after the `--color-brand-mint` line ~L52), add:

```css
/* Status accent tokens (cat lifecycle) */
--color-status-adopted: #2f7d9c; /* teal-blue */
--color-status-mia: #d98a1f; /* amber */
```

- [ ] **Step 2: Rewrite `statusAccent`**

In `components/app-pages/shared/cat-card.tsx`, replace the `statusAccent` function body so each status has a distinct, readable chip + rail (solid-ish fills, AA-ish contrast):

```tsx
function statusAccent(cat: CatCardProps["cat"]): {
  rail: string;
  chip: { label: string; cls: string } | null;
} {
  if (cat.cat_status === "Deceased") {
    return {
      rail: "bg-brand-dark",
      chip: { label: "Deceased", cls: "bg-brand-dark text-white" },
    };
  }
  if (cat.cat_status === "MIA") {
    return {
      rail: "bg-status-mia",
      chip: { label: "MIA", cls: "bg-status-mia text-white" },
    };
  }
  if (cat.cat_status === "Adopted") {
    return {
      rail: "bg-status-adopted",
      chip: { label: "Adopted", cls: "bg-status-adopted text-white" },
    };
  }
  if (cat.cat_status === "Fostered") {
    return {
      rail: "bg-brand-orange",
      chip: { label: "Fostered", cls: "bg-brand-orange text-white" },
    };
  }
  if (cat.is_adoptable) {
    return {
      rail: "bg-brand-green",
      chip: { label: "Adoptable", cls: "bg-brand-green text-white" },
    };
  }
  return { rail: "bg-brand-green", chip: null };
}
```

The `default`-variant chip uses `backdrop-blur` over the photo; solid fills read fine there — no other change needed.

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/app-pages/shared/cat-card.tsx
git commit -m "fix(cat-card): distinct readable status badge colors + tokens"
```

---

### Task 11: Cat card responsiveness — stop content vanishing (#15)

**Files:**

- Modify: `components/app-pages/shared/cat-card.tsx`
- Modify: `components/app-pages/database/database-list-screen.tsx`

- [ ] **Step 1: Allow the name to wrap instead of truncating to nothing**

In the `default` variant of `cat-card.tsx`, change the name `<h3>` class from `… truncate` to `… line-clamp-2` (keeps it bounded but visible). Leave `compact`/`wide` as-is.

- [ ] **Step 2: Widen database grid columns at small widths**

In `database-list-screen.tsx`, the mobile grid is `grid grid-cols-2 gap-3`. Change to `grid grid-cols-1 gap-3 xs:grid-cols-2` so cards aren't crushed on the narrowest phones. For the desktop list grid (locate the `tablet:` grid for cards), ensure it uses `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` with `gap-3` — adjust the existing class to that responsive ladder if it differs.

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/app-pages/shared/cat-card.tsx components/app-pages/database/database-list-screen.tsx
git commit -m "fix(database): responsive card grid; name wraps instead of vanishing"
```

---

### Task 12: Database trash placement + mobile title (#2, #11)

**Files:**

- Modify: `components/app-pages/database/database-list-screen.tsx`

- [ ] **Step 1: Move the delete FAB off the text row**

For both delete `<button>`s (the grid instances at ~L193 and ~L283), change the position classes from `absolute bottom-2 right-2` to `absolute left-2 top-2` so the button sits on the photo's top-left, clear of the status chip (top-right) and the bottom text row.

- [ ] **Step 2: Remove the inline mobile "Add Entry" button, add a title**

In the `tablet:hidden` section, delete the inline `Add Entry` button block:

```tsx
{
  canManage ? (
    <button
      type="button"
      onClick={() => setShowAdd(true)}
      className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-dark py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
    >
      Add Entry <PlusIcon className="h-4 w-4" />
    </button>
  ) : null;
}
```

Replace it with a mobile header (keep the FAB at L213 untouched):

```tsx
<div>
  <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-dark">
    Database
  </h1>
  <p className="mt-0.5 text-xs font-semibold text-brand-green">
    {cats.length} cats on record
  </p>
</div>
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors (note: `PlusIcon` is still used by the FAB, so the import stays).

- [ ] **Step 4: Commit**

```bash
git add components/app-pages/database/database-list-screen.tsx
git commit -m "fix(database): trash button placement; mobile title replaces inline add"
```

---

## Phase F — Sessions table (#12)

### Task 13: Merge status/continue column + align rows

**Files:**

- Modify: `components/app-pages/sessions/sessions-screen.tsx`

There are four table instances: mobile dashboard (~L437), mobile all-sessions (~L290), desktop dashboard (~L759), desktop all-sessions (~L626). Apply the same two changes to each.

- [ ] **Step 1: Desktop tables — collapse status + continue into one column**

For both desktop tables, the column template is `grid-cols-[1fr_1fr_1fr_auto_auto_2rem]` (Census/Date/Location/Status/Continue/Delete). Change to a fixed-track template so empty cells still occupy their track:

```
grid-cols-[1fr_8rem_1fr_9rem_2.5rem]
```

Header row becomes: `Census No.`, `Date`, `Location`, `Status`, ``(empty for delete). Update both the header`<div>`and each row`<div>` to this template (5 columns).

Replace the separate Status-badge cell **and** the Continue cell with a single status cell:

```tsx
<div className="flex items-center">
  {st === "Unfinished" ? (
    <Link
      href={`/dashboard/sessions/create?sessionId=${s.id}`}
      className="inline-flex items-center rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
    >
      Continue <span className="ml-0.5">&#8250;</span>
    </Link>
  ) : (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeClass}`}
    >
      {st}
    </span>
  )}
</div>
```

Keep the trash button as the final `2.5rem` column (render `<span />` when not Unfinished so the track stays).

- [ ] **Step 2: Mobile tables — same merge with fixed tracks**

Mobile dashboard template `grid-cols-[auto_1fr_auto_auto_auto]` and all-sessions `grid-cols-[auto_auto_1fr_auto_auto]` cause cross-row drift. Standardize each mobile table (header + rows) to a fixed template:

```
grid-cols-[2.5rem_1fr_4.5rem_2rem]
```

Columns: No. / Location (or Date) / status-cell / delete. Keep the existing column ordering per table (dashboard shows No, Location, Date; all-sessions shows No, Date, Location) — pick the 4-column layout: `No.`, primary text (`1fr`, truncate), status cell (`Continue`/badge), delete. Move the Date into the primary cell as a secondary line if needed, or keep Date as the `1fr` and drop the redundant column — the key requirement is **one shared fixed template for header and all rows** so columns align. Use the same status cell markup from Step 1 (mobile sizing: `px-2 py-0.5 text-[10px]`).

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/app-pages/sessions/sessions-screen.tsx
git commit -m "fix(sessions): unify status/continue column, fixed grid tracks align rows"
```

---

## Phase G — Users (#16, #17)

### Task 14: Mobile users tab — remove inline add, use TrashIcon (#16)

**Files:**

- Modify: `components/app-pages/users/users-screen.tsx`

- [ ] **Step 1: Remove the inline Add Entry button**

In the `tablet:hidden` block, delete the full-width button:

```tsx
<button
  type="button"
  onClick={() => setShowAddUser(true)}
  className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-dark px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 shadow-sm"
>
  Add Entry <PlusIcon className="h-4 w-4" />
</button>
```

Leave the FAB (`fixed bottom-20 right-4`) intact.

- [ ] **Step 2: Replace the emoji delete with TrashIcon**

Add `TrashIcon` to the icons import. Replace the mobile delete button's `🗑️` content with `<TrashIcon className="h-4 w-4" />`.

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors (`PlusIcon` still used by FAB + desktop button).

- [ ] **Step 4: Commit**

```bash
git add components/app-pages/users/users-screen.tsx
git commit -m "fix(users): remove inline mobile add button; TrashIcon for delete"
```

---

### Task 15: User details modal redesign (#17)

**Files:**

- Modify: `components/app-pages/shared/user-details-dialog.tsx`

- [ ] **Step 1: Rewrite the dialog**

Replace the entire file body with a cleaner, token-based design (sane type scale, rounded close button, real repo bug URL, generic email label):

```tsx
"use client";

import {
  CloseIcon,
  ExternalLinkIcon,
} from "@/components/app-pages/shared/icons";

type UserDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

const BUG_REPORT_URL = "https://github.com/legnspice/agila-app/issues";

function DetailField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-green">
        {label}
      </p>
      <div className="mt-1.5 flex min-h-11 w-full items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-dark ring-1 ring-border">
        <span className="min-w-0 truncate">{value || "—"}</span>
      </div>
    </div>
  );
}

export function UserDetailsDialog({
  open,
  onClose,
  name,
  email,
  role,
}: UserDetailsDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-brand-cream p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-dark text-white transition-opacity hover:opacity-85"
          aria-label="Close user details"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        <h2 className="pr-12 font-heading text-2xl font-bold tracking-tight text-brand-green">
          User Details
        </h2>

        <div className="mt-5 space-y-3">
          <DetailField label="Name" value={name} />
          <DetailField label="Email Address" value={email} />
          <DetailField label="Role" value={role} />
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold text-brand-green">
                Report a Bug
              </h3>
              <p className="text-sm text-brand-dark/65">Noticed an issue?</p>
            </div>
            <a
              href={BUG_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand-orange px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Report bug <ExternalLinkIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/app-pages/shared/user-details-dialog.tsx
git commit -m "fix(users): redesign user details modal; correct bug URL + email label"
```

---

## Phase H — Investigation (#7)

### Task 16: Audit service-account vs sheet protections

**Files:**

- Investigate: `lib/services/reverse-sync.service.ts`, `lib/services/helper.service.ts`, `workers/apps-script/Protection.gs`, `workers/apps-script/WebApp.gs`, `workers/apps-script/Code.gs`
- Reference: memory `project_gsheets_sync_deprecated`

- [ ] **Step 1: Grep for protection/freeze/editor calls in the write path**

Run:

```bash
pnpm exec grep -rn "syncSheetEditors\|freeze\|unfreeze\|protect\|addEditor\|removeEditor\|Protection" lib/services workers/apps-script
```

- [ ] **Step 2: Classify each hit**

For each match, determine: is it on the reverse-sync write path? Is it a deprecated guard (per memory) that should be removed, or load-bearing? Write findings into a short note: `docs/superpowers/notes/2026-06-01-service-account-protections-audit.md` (create it) listing each call site + verdict.

- [ ] **Step 3: Confirm the service account can write**

Verify (from code + config) that the service account used by reverse-sync is a sheet editor or that all protections have been removed, so writes don't silently fail. Document the conclusion in the note.

- [ ] **Step 4: Remove confirmed-dead protection calls**

Delete only the calls confirmed deprecated and unused. If any are load-bearing, leave them and document why. No behavioural change beyond removing dead guards.

- [ ] **Step 5: Type-check + tests**

Run: `pnpm tsc --noEmit`
Run: `pnpm jest` (sync suites must stay green)
Expected: no errors; tests pass.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/notes/2026-06-01-service-account-protections-audit.md lib/services workers/apps-script
git commit -m "chore(sync): audit + remove deprecated sheet-protection calls"
```

---

## Final verification

### Task 17: Full build + test sweep

- [ ] **Step 1: Type-check**

Run: `pnpm tsc --noEmit` → no errors.

- [ ] **Step 2: Test suite**

Run: `pnpm jest` → all suites pass (existing sync suites + new `census-stats`).

- [ ] **Step 3: Production build (also type-checks)**

Run: `pnpm build` → succeeds.

- [ ] **Step 4: Lint check for cascading-render / unused**

Run: `pnpm lint` (or the project's lint script) → no new errors. Pay attention to setState-in-render warnings per CLAUDE.md.

- [ ] **Step 5: Final commit (if lint fixes were needed)**

```bash
git add -A
git commit -m "chore: lint + build fixes for QA batch"
```

---

## Notes / coupling

- Tasks 1–3 must land together (shared stats module + both consumers) to keep Overview/TNVR consistent.
- Task 6 (BrandLogo) must precede Task 7 if Task 7 edits the same header region; do them in order.
- Task 8 deletes the `non-ateneo-email-used` route — confirm no links remain (Step 4 grep).
- Off-census statuses are exactly `["Fostered","Adopted","MIA","Deceased"]` (see `lib/db/enums.ts` `CAT_STATUS_VALUES`). Active cats have `cat_status = null`.
