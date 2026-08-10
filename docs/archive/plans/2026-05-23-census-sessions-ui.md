# Census Sessions UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 UI/functionality gaps in the Census Sessions section identified against Figma designs, the project spec, and the merge flow spec.

**Architecture:** All changes are UI-layer fixes within the sessions screen components and their shared dialog file. The merge flow needs two `editCat` writes instead of one. No schema or repo changes are required — `getCatHealthRecords` action already exists for fetching condition.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS 4, next-safe-action, Drizzle ORM, Supabase

---

## Files Modified

| File | What changes |
|---|---|
| `components/app-pages/sessions/session-dialogs.tsx` | Redesign `MergeDetailsDialog` to Option A diff UI; export `MergeFieldDef` type; add `condition` + `notes` fields |
| `components/app-pages/sessions/sessions-approval-crossref-screen.tsx` | Complete two-step merge; fetch condition via `getCatHealthRecords`; wire search; replace `CatIcon` with `CatPhoto` |
| `components/app-pages/sessions/sessions-screen.tsx` | Global Priority Locations; Census Report as external link; "More" expand; wire search in See All; `CreateSessionDialog` on "Create New"; desktop pagination |
| `components/app-pages/sessions/sessions-create-screen.tsx` | Remove inline session creation (moves to landing); location-as-heading; replace `CatIcon` with `CatPhoto`; trash icon per cat; card tap → DB detail |
| `components/app-pages/sessions/sessions-manager-screen.tsx` | "My Sessions" back button label; Census Report as external link; replace `CatIcon` with `CatPhoto` |

---

## Task 1: Redesign MergeDetailsDialog (Option A — diff-only, default to new)

**File:** `components/app-pages/sessions/session-dialogs.tsx`

Replace the entire `MergeDetailsDialog` section (lines 393–494) with the Option A implementation. Keep all other dialogs unchanged.

- [ ] **Step 1: Replace `MergeDetailsDialog` and export `MergeFieldDef`**

Replace from `// ─── Merge Details Dialog` to end of file with:

```tsx
// ─── Merge Details Dialog (Option A — diff-only, default to new) ─────────────

export type MergeFieldDef = {
  label: string;
  fieldKey: string;
  currentValue: string | null;
  newValue: string | null;
  inputType: "pill" | "textarea";
};

type MergeDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  targetName: string | null;
  diffFields: MergeFieldDef[];
  autoMergedCount: number;
  onMerge: (resolved: Record<string, string | null>) => void;
  isLoading?: boolean;
};

export function MergeDetailsDialog({
  open,
  onClose,
  targetName,
  diffFields,
  autoMergedCount,
  onMerge,
  isLoading,
}: MergeDetailsDialogProps) {
  const [selections, setSelections] = useState<Record<string, "new" | "current">>({});
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [autoExpanded, setAutoExpanded] = useState(false);

  // Reset to defaults whenever the dialog opens with new fields
  useEffect(() => {
    if (!open) return;
    setSelections(
      Object.fromEntries(
        diffFields
          .filter((f) => f.inputType === "pill")
          .map((f) => [f.fieldKey, "new" as const]),
      ),
    );
    setTextValues(
      Object.fromEntries(
        diffFields
          .filter((f) => f.inputType === "textarea")
          .map((f) => [f.fieldKey, f.newValue ?? ""]),
      ),
    );
    setAutoExpanded(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    setSelections(
      Object.fromEntries(
        diffFields
          .filter((f) => f.inputType === "pill")
          .map((f) => [f.fieldKey, "new" as const]),
      ),
    );
    setTextValues(
      Object.fromEntries(
        diffFields
          .filter((f) => f.inputType === "textarea")
          .map((f) => [f.fieldKey, f.newValue ?? ""]),
      ),
    );
  };

  const handleMerge = () => {
    const resolved: Record<string, string | null> = {};
    for (const field of diffFields) {
      if (field.inputType === "pill") {
        const sel = selections[field.fieldKey] ?? "new";
        resolved[field.fieldKey] = sel === "new" ? field.newValue : field.currentValue;
      } else {
        resolved[field.fieldKey] = textValues[field.fieldKey] ?? null;
      }
    }
    onMerge(resolved);
  };

  const pillFields = diffFields.filter((f) => f.inputType === "pill");
  const textareaFields = diffFields.filter((f) => f.inputType === "textarea");

  return (
    <Shell open={open} onClose={onClose}>
      <Header
        title="Merge Details"
        subtitle={targetName ? `Merging into ${targetName}` : undefined}
        onClose={onClose}
      />

      {diffFields.length > 0 ? (
        <p className="text-xs text-brand-dark/60">
          {pillFields.length} field{pillFields.length !== 1 ? "s" : ""} differ
          {autoMergedCount > 0 ? ` · ${autoMergedCount} auto-merged` : ""}
        </p>
      ) : (
        <p className="text-xs text-brand-dark/60">All fields match — only notes to review.</p>
      )}

      <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
        {pillFields.map((field) => (
          <div key={field.fieldKey}>
            <p className="mb-1.5 text-sm font-semibold text-brand-orange">{field.label}</p>
            <div className="space-y-1.5">
              {(["new", "current"] as const).map((side) => {
                const value = side === "new" ? field.newValue : field.currentValue;
                const selected = (selections[field.fieldKey] ?? "new") === side;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() =>
                      setSelections((s) => ({ ...s, [field.fieldKey]: side }))
                    }
                    className={`flex w-full items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      selected
                        ? "border-brand-green bg-brand-green text-white"
                        : "border-brand-dark/15 bg-brand-cream text-brand-dark hover:bg-brand-cream-dark"
                    }`}
                  >
                    <span
                      className={`w-12 shrink-0 text-left text-[10px] font-bold uppercase tracking-wider ${
                        selected ? "text-white/70" : "text-brand-dark/40"
                      }`}
                    >
                      {side === "new" ? "New" : "Current"}
                    </span>
                    <span className="flex-1 text-left">{value ?? "—"}</span>
                    {selected ? <span className="text-xs">✓</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {textareaFields.map((field) => (
          <div key={field.fieldKey}>
            <p className="mb-1.5 text-sm font-semibold text-brand-orange">{field.label}</p>
            {field.currentValue ? (
              <p className="mb-1.5 rounded-xl bg-brand-cream-dark px-3 py-2 text-xs italic text-brand-dark/60">
                Current: &ldquo;{field.currentValue}&rdquo;
              </p>
            ) : null}
            <textarea
              value={textValues[field.fieldKey] ?? ""}
              onChange={(e) =>
                setTextValues((s) => ({ ...s, [field.fieldKey]: e.target.value }))
              }
              rows={3}
              placeholder="No notes"
              className="w-full rounded-xl border border-brand-dark/15 bg-white px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-green"
            />
          </div>
        ))}
      </div>

      {autoMergedCount > 0 ? (
        <button
          type="button"
          onClick={() => setAutoExpanded((s) => !s)}
          className="flex w-full items-center gap-1 text-xs font-semibold text-brand-dark/50 transition-colors hover:text-brand-dark/80"
        >
          <span>{autoExpanded ? "▾" : "▸"}</span>
          {autoMergedCount} field{autoMergedCount !== 1 ? "s" : ""} matched — auto-merged
        </button>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80"
        >
          Reset <span>✕</span>
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={handleMerge}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Merging..." : "Merge"} <span>✓</span>
        </button>
      </div>
    </Shell>
  );
}
```

Also add `useEffect` to the existing React import at the top of the file:
```tsx
import { useState, useEffect, type ReactNode } from "react";
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no errors in `session-dialogs.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/app-pages/sessions/session-dialogs.tsx
git commit -m "feat(sessions): redesign MergeDetailsDialog to diff-only Option A UI"
```

---

## Task 2: Complete Crossref Merge Flow + CatPhoto + Search

**File:** `components/app-pages/sessions/sessions-approval-crossref-screen.tsx`

Four changes in one file: (a) complete the two-step merge, (b) fetch condition for both cats, (c) wire search, (d) replace `CatIcon` with `CatPhoto`.

- [ ] **Step 1: Update imports**

Replace the existing import block at the top of the file with:

```tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DetailHeader,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import {
  ApproveSessionDialog,
  DiscardSessionDialog,
  MergeDetailsDialog,
} from "@/components/app-pages/sessions/session-dialogs";
import type { MergeFieldDef } from "@/components/app-pages/sessions/session-dialogs";
import {
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import { getCats, editCat, removeCat, getCatHealthRecords } from "@/app/actions/cats";
import { syncAllPendingRegions } from "@/app/actions/google-sheets";
import type { SelectCat } from "@/lib/validation/cats";
import type { CatEntryStatus } from "@/lib/db/enums";
```

- [ ] **Step 2: Replace state declarations**

Replace all `useState` / `useCallback` declarations in `SessionsApprovalCrossRefScreen` with:

```tsx
const router = useRouter();
const searchParams = useSearchParams();
const catId = searchParams.get("catId");
const sessionId = searchParams.get("sessionId");
const sessionCatId = searchParams.get("sessionCatId");

const [cat, setCat] = useState<SelectCat | null>(null);
const [allCats, setAllCats] = useState<SelectCat[]>([]);
const [loading, setLoading] = useState(true);
const [searchQuery, setSearchQuery] = useState("");
const [showSearch, setShowSearch] = useState(false);
const [showMergeConfirm, setShowMergeConfirm] = useState(false);
const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
const [mergeDiffFields, setMergeDiffFields] = useState<MergeFieldDef[]>([]);
const [mergeAutoMergedCount, setMergeAutoMergedCount] = useState(0);
const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
const [showApproveConfirm, setShowApproveConfirm] = useState(false);
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
```

- [ ] **Step 3: Add helper to build diff fields**

Add this pure function directly above `SessionsApprovalCrossRefScreen`:

```tsx
function buildMergeDiff(
  newCat: SelectCat,
  targetCat: SelectCat,
  newCondition: string | null,
  targetCondition: string | null,
): { diffFields: MergeFieldDef[]; autoMergedCount: number } {
  const candidates: MergeFieldDef[] = [
    { label: "Color", fieldKey: "color", currentValue: targetCat.color ?? null, newValue: newCat.color ?? null, inputType: "pill" },
    { label: "Size/Age", fieldKey: "age", currentValue: targetCat.age ?? null, newValue: newCat.age ?? null, inputType: "pill" },
    { label: "Sex", fieldKey: "sex", currentValue: targetCat.sex ?? null, newValue: newCat.sex ?? null, inputType: "pill" },
    { label: "Sociability", fieldKey: "sociability", currentValue: targetCat.sociability ?? null, newValue: newCat.sociability ?? null, inputType: "pill" },
    { label: "Status", fieldKey: "cat_status", currentValue: targetCat.cat_status ?? null, newValue: newCat.cat_status ?? null, inputType: "pill" },
    { label: "Condition", fieldKey: "condition", currentValue: targetCondition, newValue: newCondition, inputType: "pill" },
    { label: "Notes", fieldKey: "notes", currentValue: targetCat.notes ?? null, newValue: newCat.notes ?? null, inputType: "textarea" },
  ];

  const pillCandidates = candidates.filter((f) => f.inputType === "pill");
  const diffFields = [
    ...pillCandidates.filter((f) => f.currentValue !== f.newValue),
    ...candidates.filter((f) => f.inputType === "textarea"),
  ];
  const autoMergedCount = pillCandidates.filter((f) => f.currentValue === f.newValue).length;

  return { diffFields, autoMergedCount };
}
```

- [ ] **Step 4: Replace `handleMerge` and add `handleSelectTarget`**

Remove the existing `handleMerge` and `mergeTargetCat` useMemo. Replace with:

```tsx
const mergeTargetCat = useMemo(
  () => (mergeTargetId ? allCats.find((c) => c.id === mergeTargetId) ?? null : null),
  [mergeTargetId, allCats],
);

const handleSelectTarget = useCallback(
  async (targetId: string) => {
    if (!catId || !cat) return;
    setMergeTargetId(targetId);

    const target = allCats.find((c) => c.id === targetId);
    if (!target) return;

    const [newHRResult, targetHRResult] = await Promise.all([
      getCatHealthRecords({ cat_id: catId }),
      getCatHealthRecords({ cat_id: targetId }),
    ]);
    const newCondition = newHRResult?.data?.[0]?.condition ?? null;
    const targetCondition = targetHRResult?.data?.[0]?.condition ?? null;

    const { diffFields, autoMergedCount } = buildMergeDiff(cat, target, newCondition, targetCondition);
    setMergeDiffFields(diffFields);
    setMergeAutoMergedCount(autoMergedCount);
    setShowMergeConfirm(true);
  },
  [catId, cat, allCats],
);

const handleMerge = useCallback(
  async (resolved: Record<string, string | null>) => {
    if (!catId || !mergeTargetId) return;
    setSaving(true);
    setError(null);
    try {
      // Step 1: update original with manager-selected field values
      await editCat({
        id: mergeTargetId,
        color: resolved.color as SelectCat["color"] ?? undefined,
        age: resolved.age as SelectCat["age"] ?? undefined,
        sex: resolved.sex as SelectCat["sex"] ?? undefined,
        sociability: resolved.sociability as SelectCat["sociability"] ?? undefined,
        cat_status: resolved.cat_status as SelectCat["cat_status"] ?? undefined,
        condition: resolved.condition as "Healthy" | "Sick" | "Injured" | "Sick and Injured" | undefined ?? undefined,
        notes: resolved.notes ?? undefined,
      });
      // Step 2: mark duplicate as merged
      await editCat({
        id: catId,
        merged_into_id: mergeTargetId,
        entry_status: "Merged" as CatEntryStatus,
      });
      syncAllPendingRegions();
      setShowMergeConfirm(false);
      router.push("/dashboard/sessions/manager");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge.");
    } finally {
      setSaving(false);
    }
  },
  [catId, mergeTargetId, router],
);
```

- [ ] **Step 5: Add search filter for candidate cats**

Add this `useMemo` after `similarCats`:

```tsx
const filteredCandidates = useMemo(() => {
  const base = searchQuery.trim()
    ? allCats.filter(
        (c) =>
          c.entry_status === "Original" &&
          (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.color?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.spot_last_seen?.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : similarCats;
  return base;
}, [searchQuery, allCats, similarCats]);
```

- [ ] **Step 6: Replace `CatIcon` with `CatPhoto` in the candidate cat cards**

In the mobile cat card render, find the image column div (the `flex w-28 shrink-0 items-center justify-center bg-white/10` div with `CatIcon` inside). Replace it:

```tsx
<CatPhoto
  photoUrl={item.cat.photo_url}  // replace `item` with the variable name used in your map
  name={item.cat.name}
  className="h-28 w-28 shrink-0 object-cover"
  iconClassName="h-10 w-10 text-white/40"
/>
```

Do the same replacement in the desktop card render.

For candidate cat cards in the cross-reference list, replace the `CatIcon` placeholder div with:

```tsx
<CatPhoto
  photoUrl={c.photo_url}
  name={c.name}
  className="h-full w-full object-cover"
  iconClassName="h-8 w-8 text-white/40"
/>
```

- [ ] **Step 7: Wire search UI and replace `···` with `handleSelectTarget`**

In the Search/Filter/Sort bar (mobile), replace the Search button with:

```tsx
<button
  type="button"
  onClick={() => setShowSearch((s) => !s)}
  className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
>
  Search <SearchIcon className="h-4 w-4" />
</button>
{showSearch ? (
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="Name, color, or location…"
    autoFocus
    className="mt-2 h-9 w-full rounded-full border border-brand-dark/15 bg-white px-4 text-sm text-brand-dark outline-none focus:border-brand-green"
  />
) : null}
```

In the candidate cats list, change the map source from `similarCats` to `filteredCandidates`.

Change the `···` button on each candidate card to call `handleSelectTarget`:

```tsx
<button
  type="button"
  onClick={() => handleSelectTarget(c.id)}
  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-dark text-white/80 transition-opacity hover:opacity-80"
>
  ···
</button>
```

- [ ] **Step 8: Update `MergeDetailsDialog` invocation**

Replace the existing `MergeDetailsDialog` JSX at the bottom of the return statement with:

```tsx
<MergeDetailsDialog
  open={showMergeConfirm}
  onClose={() => setShowMergeConfirm(false)}
  targetName={mergeTargetCat?.name ?? null}
  diffFields={mergeDiffFields}
  autoMergedCount={mergeAutoMergedCount}
  onMerge={handleMerge}
  isLoading={saving}
/>
```

- [ ] **Step 9: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no errors in `sessions-approval-crossref-screen.tsx`.

- [ ] **Step 10: Commit**

```bash
git add components/app-pages/sessions/sessions-approval-crossref-screen.tsx
git commit -m "feat(sessions): complete merge flow, add search, replace CatIcon with CatPhoto in crossref"
```

---

## Task 3: Fix sessions-screen.tsx

**File:** `components/app-pages/sessions/sessions-screen.tsx`

Six changes: global Priority Locations, Census Report external link, "More" expand, search in See All, `CreateSessionDialog` on "Create New", desktop pagination.

- [ ] **Step 1: Add new imports and constants**

Add to the top of the file, after existing imports:

```tsx
import { useRouter } from "next/navigation";
import { createSession } from "@/app/actions/sessions";
import { CreateSessionDialog } from "@/components/app-pages/sessions/session-dialogs";

const CENSUS_REPORT_URL = "#"; // TODO: replace with actual Google Docs folder URL
```

- [ ] **Step 2: Add new state variables**

Inside `SessionsScreen`, add after the existing state declarations:

```tsx
const [allSessions, setAllSessions] = useState<SelectSession[]>([]);
const [showMoreLocations, setShowMoreLocations] = useState(false);
const [showCreateDialog, setShowCreateDialog] = useState(false);
const [newSessionRegionId, setNewSessionRegionId] = useState("");
const [creatingSession, setCreatingSession] = useState(false);
const [desktopPage, setDesktopPage] = useState(1);
const router = useRouter();
```

- [ ] **Step 3: Store all sessions in `fetchSessions`**

In `fetchSessions`, on the line where `mine` is derived, also set `allSessions`:

```tsx
const all = sessionsRes?.data ?? [];
const mine = all.filter((s) => myIds.has(s.id));
setAllSessions(all);   // ← add this line
setSessions(mine);
```

- [ ] **Step 4: Update `priorityLocations` to use `allSessions`**

In the `priorityLocations` useMemo, change `sessions` to `allSessions` in both the iteration and the dependency array:

```tsx
const priorityLocations = useMemo(() => {
  const regionLastSession = new Map<string, number>();
  for (const s of allSessions) {          // ← was `sessions`
    const rid = s.region_id;
    const date = new Date(s.created_at).getTime();
    const existing = regionLastSession.get(rid);
    if (!existing || date > existing) regionLastSession.set(rid, date);
  }
  // ... rest unchanged
}, [allSessions, regionMap]);             // ← was `[sessions, regionMap]`
```

- [ ] **Step 5: Add `handleCreateSession`**

Add this handler inside `SessionsScreen`:

```tsx
const handleCreateSession = useCallback(async () => {
  if (!newSessionRegionId || !userId) return;
  setCreatingSession(true);
  try {
    const result = await createSession({ region_id: newSessionRegionId, user_id: userId });
    if (result?.serverError) return;
    const newSession = result?.data;
    if (!newSession?.id) return;
    setShowCreateDialog(false);
    setNewSessionRegionId("");
    router.push(`/dashboard/sessions/create?sessionId=${newSession.id}`);
  } finally {
    setCreatingSession(false);
  }
}, [newSessionRegionId, userId, router]);
```

- [ ] **Step 6: Replace "Create New" links with dialog trigger**

There are three "Create New" `<Link>` elements in the component (dashboard view, see-all view, desktop). Replace each with:

```tsx
<button
  type="button"
  onClick={() => setShowCreateDialog(true)}
  className="flex items-center gap-1.5 rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
>
  Create New <span className="text-sm">+</span>
</button>
```

Also remove the FAB `<Link href="/dashboard/sessions/create">` and replace it with:

```tsx
<button
  type="button"
  onClick={() => setShowCreateDialog(true)}
  className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange shadow-lg transition-opacity hover:opacity-90"
>
  <PlusIcon className="h-6 w-6 text-white" />
</button>
```

- [ ] **Step 7: Replace Census Report buttons with external links**

For each Census Report `<button onClick={handleCensusReport}>` (there are three — dashboard mobile, see-all mobile, desktop), replace with:

```tsx
<a
  href={CENSUS_REPORT_URL}
  target="_blank"
  rel="noopener noreferrer"
  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-dark py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
>
  Census Report
</a>
```

Adjust `flex-1` / sizing classes to match the original button's context. Remove `handleCensusReport`, `catCountBySession`, and the `handleCensusReport` useCallback entirely.

- [ ] **Step 8: Add "More" / "Show less" to Priority Locations**

In the `priorityLocations` useMemo, remove the `.slice(0, 5)` — return all entries sorted:

```tsx
return entries
  .sort((a, b) => { ... })
  // remove .slice(0, 5)
  .map((entry) => ({
    name: entry.name,
    daysSince: entry.daysSince == null ? "Unknown" : String(entry.daysSince),
  }));
```

In the Priority Locations render, slice conditionally and add the More link:

```tsx
{(showMoreLocations ? priorityLocations : priorityLocations.slice(0, 5)).map((loc) => (
  <div key={loc.name} className="flex items-center justify-between py-2">
    <span className="text-xs font-semibold text-brand-dark">{loc.name}</span>
    <span className="text-xs tabular-nums italic text-brand-dark/65">
      {loc.daysSince === "Unknown" ? "Unknown" : `${loc.daysSince} days ago`}
    </span>
  </div>
))}
{priorityLocations.length > 5 ? (
  <button
    type="button"
    onClick={() => setShowMoreLocations((s) => !s)}
    className="pt-1 text-xs font-bold text-brand-green underline underline-offset-2"
  >
    {showMoreLocations ? "Show less" : "More"}
  </button>
) : null}
```

Apply to both mobile and desktop Priority Locations sections.

- [ ] **Step 9: Wire search in See All Sessions**

Add `searchQuery` state:

```tsx
const [searchQuery, setSearchQuery] = useState("");
```

In the See All view, replace the non-functional Search button with:

```tsx
<button
  type="button"
  onClick={() => setSearchQuery("")}
  className="..."
>
  Search <span className="text-base">🔍</span>
</button>
```

Add a search input below the filter pills (in the showAll branch):

```tsx
<input
  type="text"
  value={searchQuery}
  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
  placeholder="Search by location…"
  className="h-9 w-full rounded-full border border-brand-dark/15 bg-white px-4 text-sm text-brand-dark outline-none focus:border-brand-green"
/>
```

Filter `filteredSessions` before pagination:

```tsx
const visibleSessions = searchQuery.trim()
  ? filteredSessions.filter((s) =>
      (regionMap[s.region_id] ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
    )
  : filteredSessions;
```

Use `visibleSessions` in the `.slice(...)` render and pagination count.

- [ ] **Step 10: Add desktop pagination**

Add `desktopPage` state (already added in Step 2). In the desktop sessions table, wrap the row render with pagination:

```tsx
// Replace: filteredSessions.map((s) => { ... })
// With:
filteredSessions
  .slice((desktopPage - 1) * PAGE_SIZE, desktopPage * PAGE_SIZE)
  .map((s) => { ... })
```

Add pagination controls below the desktop table section (after `</section>`):

```tsx
{filteredSessions.length > PAGE_SIZE ? (
  <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-brand-dark/70">
    <button
      type="button"
      onClick={() => setDesktopPage((p) => Math.max(1, p - 1))}
      disabled={desktopPage === 1}
      className="disabled:opacity-40"
    >
      ‹
    </button>
    <span className="tabular-nums">
      {(desktopPage - 1) * PAGE_SIZE + 1}–{Math.min(desktopPage * PAGE_SIZE, filteredSessions.length)} / {filteredSessions.length}
    </span>
    <button
      type="button"
      onClick={() =>
        setDesktopPage((p) => Math.min(Math.ceil(filteredSessions.length / PAGE_SIZE), p + 1))
      }
      disabled={desktopPage >= Math.ceil(filteredSessions.length / PAGE_SIZE)}
      className="disabled:opacity-40"
    >
      ›
    </button>
  </div>
) : null}
```

- [ ] **Step 11: Add `CreateSessionDialog` at the bottom of the return**

Before the closing `</>`, add:

```tsx
<CreateSessionDialog
  open={showCreateDialog}
  onClose={() => { setShowCreateDialog(false); setNewSessionRegionId(""); }}
  regionId={newSessionRegionId}
  onRegionChange={setNewSessionRegionId}
  regionOptions={regionOptions}
  onCreate={handleCreateSession}
  creating={creatingSession}
/>
```

This requires `regionOptions` state in `sessions-screen.tsx`. Add it:

```tsx
const [regionOptions, setRegionOptions] = useState<{ id: string; name: string }[]>([]);
```

And populate it in `fetchRegions`:

```tsx
setRegionOptions(data.filter((r): r is { id: string; name: string } => Boolean(r?.id && r?.name)));
```

- [ ] **Step 12: Fix "Unknown days" label on desktop Priority Locations**

In the desktop Priority Locations render (around line 699), change:

```tsx
<span className="tabular-nums text-brand-dark/70">
  {loc.daysSince} days   {/* ← was always appending " days" */}
</span>
```

To:

```tsx
<span className="tabular-nums text-brand-dark/70">
  {loc.daysSince === "Unknown" ? "Unknown" : `${loc.daysSince} days`}
</span>
```

- [ ] **Step 13: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 14: Commit**

```bash
git add components/app-pages/sessions/sessions-screen.tsx
git commit -m "feat(sessions): global priority locations, census report link, create dialog, search, pagination"
```

---

## Task 4: Fix sessions-create-screen.tsx

**File:** `components/app-pages/sessions/sessions-create-screen.tsx`

Remove inline session creation (now handled by landing dialog). Add location heading, `CatPhoto`, trash icon, and card navigation.

- [ ] **Step 1: Update imports**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CatIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/app-pages/shared/icons";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import {
  DiscardSessionDialog,
  FinishSessionDialog,
} from "@/components/app-pages/sessions/session-dialogs";
import { useAuth } from "@/contexts/auth-context";
import {
  getSessionCats,
  getSessions,
  editSession,
  removeSession,
  removeSessionCat,
} from "@/app/actions/sessions";
import { getCats } from "@/app/actions/cats";
import type { SelectCat } from "@/lib/validation/cats";
import type { SelectSessionCat } from "@/lib/validation/sessions";
```

Note: `createSession`, `CustomSelect`, `ChevronDownIcon`, `PlusCircleIcon` are no longer needed — remove them.

- [ ] **Step 2: Change `cats` state type to include `sessionCatId`**

Replace:

```tsx
const [cats, setCats] = useState<SelectCat[]>([]);
```

With:

```tsx
type SessionCatEntry = { cat: SelectCat; sessionCatId: string };
const [cats, setCats] = useState<SessionCatEntry[]>([]);
const [removingCatId, setRemovingCatId] = useState<string | null>(null);
```

- [ ] **Step 3: Update `fetchSessionCats` to store `sessionCatId`**

Replace the existing `fetchSessionCats`:

```tsx
const fetchSessionCats = useCallback(async (sid: string) => {
  try {
    const scResult = await getSessionCats({ session_id: sid });
    const sessionCats = scResult?.data ?? [];
    if (sessionCats.length === 0) {
      setCats([]);
      return;
    }
    const catPromises = sessionCats.map((sc: SelectSessionCat) => getCats({ id: sc.cat_id }));
    const catResults = await Promise.all(catPromises);
    const entries: SessionCatEntry[] = catResults
      .map((r, i) => {
        const cat = r?.data?.[0];
        if (!cat) return null;
        return { cat, sessionCatId: sessionCats[i].id };
      })
      .filter((e): e is SessionCatEntry => e !== null);
    setCats(entries);
  } catch (err) {
    console.error("Failed to fetch session cats:", err);
  }
}, []);
```

- [ ] **Step 4: Remove `handleLocationSelect` and inline select state**

Delete:
- `handleLocationSelect` callback
- `selectedRegionId` state (keep `selectedRegionName` for display)
- `regionOptions` state and `loadRegions` callback
- The `useEffect` that called `loadRegions`
- The `useEffect` that synced `selectedRegionName` from `selectedRegionId`

Replace with a simpler name resolution in `hydrateExistingSession`:

```tsx
const hydrateExistingSession = useCallback(
  async (sid: string) => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [sessionResult, regionsResult] = await Promise.all([
        getSessions({ id: sid }),
        supabase.from("regions").select("id,name"),
      ]);
      const existing = sessionResult?.data?.[0];
      if (!existing) { setError("Session not found."); return; }

      setSessionId(existing.id);
      const regionName = (regionsResult.data ?? []).find((r) => r.id === existing.region_id)?.name ?? "Unknown Location";
      setSelectedRegionName(regionName);
      await fetchSessionCats(existing.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session.");
    } finally {
      setLoading(false);
    }
  },
  [fetchSessionCats],
);
```

Keep only these state variables at the top:
```tsx
const [sessionId, setSessionId] = useState<string | null>(existingSessionId);
const [selectedRegionName, setSelectedRegionName] = useState("");
const [cats, setCats] = useState<SessionCatEntry[]>([]);
const [loading, setLoading] = useState(false);
const [showAddForm, setShowAddForm] = useState(false);
const [showFinish, setShowFinish] = useState(false);
const [showDiscard, setShowDiscard] = useState(false);
const [submitting, setSubmitting] = useState(false);
const [discarding, setDiscarding] = useState(false);
const [removingCatId, setRemovingCatId] = useState<string | null>(null);
const [error, setError] = useState<string | null>(null);
```

- [ ] **Step 5: Add `handleRemoveCat`**

```tsx
const handleRemoveCat = useCallback(async (sessionCatId: string) => {
  setRemovingCatId(sessionCatId);
  try {
    await removeSessionCat.bind(null, sessionCatId)();
    if (sessionId) await fetchSessionCats(sessionId);
  } finally {
    setRemovingCatId(null);
  }
}, [sessionId, fetchSessionCats]);
```

- [ ] **Step 6: Handle missing sessionId**

In the component, add an early return if there's no `existingSessionId`:

```tsx
if (!existingSessionId) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm text-brand-dark/60">No session found.</p>
      <Link
        href="/dashboard/sessions"
        className="rounded-full bg-brand-orange px-5 py-2 text-sm font-bold text-white"
      >
        ← Back to Sessions
      </Link>
    </div>
  );
}
```

Place this after all hooks but before the return statement.

- [ ] **Step 7: Update mobile cat card render**

Replace the existing mobile cat card (the `div.overflow-hidden.rounded-2xl.bg-brand-green` block) with:

```tsx
{cats.map(({ cat, sessionCatId }) => (
  <div
    key={cat.id}
    className="overflow-hidden rounded-2xl bg-brand-green"
  >
    <div className="flex items-stretch gap-0">
      {/* Photo — tapping navigates to cat detail */}
      <Link
        href={`/dashboard/database/general?id=${cat.id}`}
        className="flex w-24 shrink-0 items-center justify-center bg-white/10"
      >
        <CatPhoto
          photoUrl={cat.photo_url}
          name={cat.name}
          className="h-full w-full object-cover"
          iconClassName="h-10 w-10 text-white/40"
        />
      </Link>
      {/* Info — tapping navigates to cat detail */}
      <Link
        href={`/dashboard/database/general?id=${cat.id}`}
        className="flex min-w-0 flex-1 items-start justify-between px-3.5 py-3"
      >
        <div className="min-w-0 flex-1">
          <p className="font-heading text-xl font-bold leading-tight text-brand-yellow">
            {cat.name || "Unnamed"}
            {sexSymbol(cat.sex) ? (
              <span className="ml-1 text-white/80">{sexSymbol(cat.sex)}</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-white/70">
            {cat.color || "Unknown"}{cat.age ? ` Size/${cat.age}` : ""}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {cat.spot_last_seen || "—"} · {formatDate(cat.last_updated_at)}
          </p>
        </div>
      </Link>
      {/* Trash icon */}
      <button
        type="button"
        onClick={() => handleRemoveCat(sessionCatId)}
        disabled={removingCatId === sessionCatId}
        className="flex h-full w-10 shrink-0 items-center justify-center bg-brand-dark/20 transition-colors hover:bg-red-500/70 disabled:opacity-40"
        aria-label="Remove cat from session"
      >
        <TrashIcon className="h-4 w-4 text-white" />
      </button>
    </div>
  </div>
))}
```

- [ ] **Step 8: Update desktop cat card render**

Replace the existing desktop `<article>` cat card with:

```tsx
{cats.map(({ cat, sessionCatId }) => (
  <article
    key={`entry-${cat.id}`}
    className="flex items-stretch overflow-hidden rounded-2xl bg-brand-green ring-1 ring-brand-green"
  >
    <Link
      href={`/dashboard/database/general?id=${cat.id}`}
      className="flex flex-1 items-center gap-4 p-4"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15">
        <CatPhoto
          photoUrl={cat.photo_url}
          name={cat.name}
          className="h-full w-full object-cover"
          iconClassName="h-9 w-9 text-white/50"
        />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-heading text-xl font-bold tracking-tight text-white">
            {cat.name || "Unnamed"}
          </h3>
          {sexSymbol(cat.sex) ? (
            <span className={`text-xl ${sexColor(cat.sex)}`}>{sexSymbol(cat.sex)}</span>
          ) : null}
        </div>
        <div className="mt-2 flex gap-1.5">
          {cat.color ? (
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
              {cat.color}
            </span>
          ) : null}
          {cat.age ? (
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/80">
              {cat.age}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-white/70">
          Last seen: {cat.spot_last_seen || "—"} · {formatDate(cat.last_updated_at)}
        </p>
      </div>
    </Link>
    <button
      type="button"
      onClick={() => handleRemoveCat(sessionCatId)}
      disabled={removingCatId === sessionCatId}
      className="flex w-14 shrink-0 items-center justify-center bg-brand-dark/20 transition-colors hover:bg-red-500/70 disabled:opacity-40"
      aria-label="Remove cat from session"
    >
      <TrashIcon className="h-5 w-5 text-white" />
    </button>
  </article>
))}
```

- [ ] **Step 9: Replace location select with heading**

In the mobile view, replace the location `<CustomSelect>` block and the `<label>` wrapping it with:

```tsx
<div className="flex items-center justify-between">
  <h1 className="font-heading text-2xl font-bold text-brand-green">
    {selectedRegionName || "Loading…"}
  </h1>
  {sessionId ? (
    <span className="rounded-full bg-brand-green px-3 py-1.5 text-xs font-bold text-brand-yellow">
      Census No. {sessionId.slice(0, 8)}
    </span>
  ) : null}
</div>
```

In the desktop view, replace the `<label className="flex w-full max-w-72 ...">` select block with:

```tsx
<h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
  {selectedRegionName || "Loading…"}
</h2>
```

- [ ] **Step 10: Update `handleCatSaved` to work with new `cats` type**

`handleCatSaved` calls `fetchSessionCats(sessionId)` — no change needed there.

- [ ] **Step 11: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 12: Commit**

```bash
git add components/app-pages/sessions/sessions-create-screen.tsx
git commit -m "feat(sessions): location heading, CatPhoto, trash icon, card navigation on create screen"
```

---

## Task 5: Fix sessions-manager-screen.tsx

**File:** `components/app-pages/sessions/sessions-manager-screen.tsx`

Three changes: "My Sessions" back button, Census Report external link, `CatPhoto` in cat cards.

- [ ] **Step 1: Add import and constant**

Add at the top:

```tsx
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";

const CENSUS_REPORT_URL = "#"; // TODO: replace with actual Google Docs folder URL
```

- [ ] **Step 2: Replace Census Report button (mobile)**

Find the mobile Census Report `<button>` (line ~94) and replace with:

```tsx
<a
  href={CENSUS_REPORT_URL}
  target="_blank"
  rel="noopener noreferrer"
  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-brand-green py-2.5 text-sm font-bold text-brand-green transition-opacity hover:opacity-80"
>
  Census Report
</a>
```

- [ ] **Step 3: Replace Census Report button (desktop)**

Find the desktop Census Report `<button>` (line ~179) and replace with:

```tsx
<a
  href={CENSUS_REPORT_URL}
  target="_blank"
  rel="noopener noreferrer"
  className="rounded-full bg-brand-green px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
>
  Census Report
</a>
```

- [ ] **Step 4: Rename "Review Sessions" back button to "My Sessions"**

Find the `<Link href="/dashboard/sessions">` with text "Review Sessions ⊙" (mobile, line ~99) and change text to:

```tsx
My Sessions
```

Find the desktop equivalent `<Link href="/dashboard/sessions">` with text "Back" and change to:

```tsx
My Sessions ←
```

- [ ] **Step 5: Replace `CatIcon` with `CatPhoto` in mobile cat cards**

In the mobile cat card, the image column div (the `flex w-28 shrink-0 items-center justify-center bg-white/10` div), replace its content:

```tsx
<CatPhoto
  photoUrl={item.cat.photo_url}
  name={item.cat.name}
  className="h-28 w-28 object-cover"
  iconClassName="h-10 w-10 text-white/40"
/>
```

- [ ] **Step 6: Replace `CatIcon` with `CatPhoto` in desktop cat cards**

In the desktop article card, the image square (`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15`), replace its content:

```tsx
<CatPhoto
  photoUrl={item.cat.photo_url}
  name={item.cat.name}
  className="h-full w-full overflow-hidden rounded-2xl object-cover"
  iconClassName="h-9 w-9 text-white/50"
/>
```

- [ ] **Step 7: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add components/app-pages/sessions/sessions-manager-screen.tsx
git commit -m "feat(sessions): My Sessions label, census report link, CatPhoto in manager screen"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| `···` → trash icon on create screen | Task 4 Step 7–8 |
| Card tap → cat detail on create screen | Task 4 Step 7–8 |
| Complete merge flow (two editCat writes) | Task 2 Step 4 |
| `condition` + `notes` in merge dialog | Task 1 Step 1 |
| MergeDetailsDialog Option A UI | Task 1 Step 1 |
| `getCatHealthRecords` for condition fetch | Task 2 Step 4 (uses existing action) |
| Search in crossref screen | Task 2 Step 5–7 |
| `CatPhoto` in all session screens | Tasks 2, 4, 5 |
| `CreateSessionDialog` wired from landing | Task 3 Steps 5–6 |
| Location as heading on create screen | Task 4 Step 9 |
| Priority Locations global scope | Task 3 Steps 3–4 |
| Census Report → external link (all screens) | Tasks 3, 5 |
| "More" expand on Priority Locations | Task 3 Step 8 |
| Search in See All Sessions | Task 3 Step 9 |
| "My Sessions" label on manager back button | Task 5 Step 4 |
| Desktop pagination | Task 3 Step 10 |
| "Unknown days" fix on desktop | Task 3 Step 12 |

### No gaps found.

### Type consistency

- `MergeFieldDef` exported from Task 1 and imported in Task 2 ✓
- `SessionCatEntry` local type in Task 4, used only within that file ✓
- `handleMerge` in Task 2 receives `Record<string, string | null>` matching `MergeDetailsDialog.onMerge` signature from Task 1 ✓
- `handleSelectTarget` sets `mergeDiffFields: MergeFieldDef[]` which feeds `MergeDetailsDialog.diffFields` ✓
