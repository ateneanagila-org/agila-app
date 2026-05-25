# Merge Name & Photo Conflict Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface `name` and `photo_url` in the cross-reference merge dialog so reviewers can visually confirm same-cat and choose which name/photo wins, instead of silently dropping the new entry's name and photo.

**Architecture:** Extend `buildMergeDiff` in the cross-ref screen to emit `name` (pill) and `photo_url` (new `image` inputType) as diff candidates. Extend `MergeDetailsDialog` with an always-visible photo header (both photos side-by-side for visual confirmation) and an `image` inputType renderer for the selectable photo cards. Remove the dead `readonly` branch since no caller emits it. Multi-photo is explicitly out of scope — one `photo_url` per cat stays.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, existing `CatPhoto` component, existing `editCat` server action (already accepts `name` and `photo_url` via `editCatSchema`).

---

## File Structure

- Modify: `components/app-pages/sessions/session-dialogs.tsx`
  - Extend `MergeFieldDef` `inputType` union with `"image"`
  - Add always-visible photo header inside `MergeDetailsDialogContent` showing both photos when present (independent of diff)
  - Add `image`-inputType renderer (selectable photo cards using `CatPhoto`)
  - Remove dead `readonly` field renderer (no caller emits it)
- Modify: `components/app-pages/sessions/sessions-approval-crossref-screen.tsx`
  - Extend `buildMergeDiff` to include `name` (pill), `photo_url` (image), and `photoUrls` metadata for the always-visible header
  - Pass new photo header props to `MergeDetailsDialog`
  - Wire `name` and `photo_url` into the `editCat` payload in `handleMerge`

No new files. No new dependencies.

---

## Task 1: Extend MergeFieldDef and dialog header with always-visible photos

**Files:**
- Modify: `components/app-pages/sessions/session-dialogs.tsx`

- [ ] **Step 1: Add `image` to inputType union and import `CatPhoto`**

At top of `components/app-pages/sessions/session-dialogs.tsx`, add the import beside the existing icons import:

```tsx
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
```

Update the type at line 394:

```tsx
export type MergeFieldDef = {
  label: string;
  fieldKey: string;
  currentValue: string | null;
  newValue: string | null;
  inputType: "pill" | "textarea" | "image";
};
```

- [ ] **Step 2: Extend `MergeDetailsDialogProps` with photo header props**

Update the props type at line 402:

```tsx
type MergeDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  targetName: string | null;
  newPhotoUrl: string | null;
  newName: string | null;
  targetPhotoUrl: string | null;
  diffFields: MergeFieldDef[];
  autoMergedCount: number;
  onMerge: (resolved: Record<string, string | null>) => void;
  isLoading?: boolean;
};
```

- [ ] **Step 3: Update `MergeDetailsDialogContent` signature to accept new props**

At line 412, replace the function signature param list to destructure the new props (keep existing destructured names):

```tsx
function MergeDetailsDialogContent({
  onClose,
  targetName,
  newPhotoUrl,
  newName,
  targetPhotoUrl,
  diffFields,
  autoMergedCount,
  onMerge,
  isLoading,
}: Omit<MergeDetailsDialogProps, "open">) {
```

- [ ] **Step 4: Render always-visible photo header above the diff list**

Inside `MergeDetailsDialogContent`'s returned JSX, immediately after the `<Header ... />` element (currently line 459-463) and before the `pillFields.length > 0` paragraph, insert this block:

```tsx
<div className="flex items-stretch gap-2">
  <div className="flex-1 space-y-1">
    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">
      New
    </p>
    <div className="aspect-square overflow-hidden rounded-xl">
      <CatPhoto
        photoUrl={newPhotoUrl}
        name={newName}
        className="h-full w-full"
        iconClassName="h-10 w-10 text-brand-dark/30"
      />
    </div>
  </div>
  <div className="flex-1 space-y-1">
    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark/50">
      Current
    </p>
    <div className="aspect-square overflow-hidden rounded-xl">
      <CatPhoto
        photoUrl={targetPhotoUrl}
        name={targetName}
        className="h-full w-full"
        iconClassName="h-10 w-10 text-brand-dark/30"
      />
    </div>
  </div>
</div>
```

- [ ] **Step 5: Remove dead readonly renderer**

Delete the `readonlyFields` derivation (currently line 453) and the entire `readonlyFields.map(...)` block (currently lines 474-485). Nothing in the codebase emits `inputType: "readonly"` and the type union no longer includes it.

- [ ] **Step 6: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS (errors will appear at the cross-ref screen call site; that's Task 3 — for now confirm errors are only there).

---

## Task 2: Add image-inputType renderer in the diff body

**Files:**
- Modify: `components/app-pages/sessions/session-dialogs.tsx`

- [ ] **Step 1: Split image fields out and initialise selections for them**

In `MergeDetailsDialogContent`, update `defaultSelections` and the `pillFields`/`textareaFields` derivations so image fields participate in the new/current selector state. Replace the existing `defaultSelections` (line 420-423) and the field-split lines (currently 454-455) with:

```tsx
const defaultSelections = () =>
  Object.fromEntries(
    diffFields
      .filter((f) => f.inputType === "pill" || f.inputType === "image")
      .map((f) => [f.fieldKey, "new" as const]),
  );
```

And replace the field-split lines (currently `const pillFields = ...; const textareaFields = ...;`) with:

```tsx
const pillFields = diffFields.filter((f) => f.inputType === "pill");
const imageFields = diffFields.filter((f) => f.inputType === "image");
const textareaFields = diffFields.filter((f) => f.inputType === "textarea");
```

- [ ] **Step 2: Resolve image fields in `handleMerge`**

Update the loop inside `handleMerge` (currently line 441-449) so the `pill` branch also handles `image`:

```tsx
for (const field of diffFields) {
  if (field.inputType === "pill" || field.inputType === "image") {
    const sel = selections[field.fieldKey] ?? "new";
    resolved[field.fieldKey] = sel === "new" ? field.newValue : field.currentValue;
  } else {
    resolved[field.fieldKey] = textValues[field.fieldKey] ?? null;
  }
}
```

- [ ] **Step 3: Render image-field selector cards**

Inside the scrollable diff container (the `<div className="max-h-80 space-y-4 overflow-y-auto pr-1">` block, currently line 487), insert this block **before** the `pillFields.map(...)` block:

```tsx
{imageFields.map((field) => (
  <div key={field.fieldKey}>
    <p className="mb-1.5 text-sm font-semibold text-brand-orange">{field.label}</p>
    <div className="grid grid-cols-2 gap-2">
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
            className={`flex flex-col items-stretch gap-1.5 rounded-xl border-2 p-1.5 transition-colors ${
              selected
                ? "border-brand-green bg-brand-green/10"
                : "border-brand-dark/15 bg-brand-cream hover:bg-brand-cream-dark"
            }`}
          >
            <div className="aspect-square overflow-hidden rounded-lg">
              <CatPhoto
                photoUrl={value}
                name={side === "new" ? newName : targetName}
                className="h-full w-full"
                iconClassName="h-8 w-8 text-brand-dark/30"
              />
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-dark/60">
                {side === "new" ? "New" : "Current"}
              </span>
              {selected ? <span className="text-xs text-brand-green">✓</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  </div>
))}
```

- [ ] **Step 4: Update the "fields differ" counter to include image fields**

Replace the paragraph at currently line 465-472 with:

```tsx
{pillFields.length > 0 || imageFields.length > 0 || textareaFields.length > 0 ? (
  <p className="text-xs text-brand-dark/60">
    {pillFields.length + imageFields.length} field
    {pillFields.length + imageFields.length !== 1 ? "s" : ""} differ
    {autoMergedCount > 0 ? ` · ${autoMergedCount} auto-merged` : ""}
  </p>
) : (
  <p className="text-xs text-brand-dark/60">All fields match — only notes to review.</p>
)}
```

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: same errors as Task 1 (cross-ref screen call site); fixed in Task 3.

---

## Task 3: Wire name + photo_url through `buildMergeDiff` and `handleMerge`

**Files:**
- Modify: `components/app-pages/sessions/sessions-approval-crossref-screen.tsx`

- [ ] **Step 1: Extend `buildMergeDiff` with `name` and `photo_url` candidates**

In `components/app-pages/sessions/sessions-approval-crossref-screen.tsx`, replace the `candidates` array inside `buildMergeDiff` (line 36-86) so `name` is prepended and `photo_url` is appended:

```tsx
const candidates: MergeFieldDef[] = [
  {
    label: "Name",
    fieldKey: "name",
    currentValue: targetCat.name ?? null,
    newValue: newCat.name ?? null,
    inputType: "pill",
  },
  {
    label: "Color",
    fieldKey: "color",
    currentValue: targetCat.color ?? null,
    newValue: newCat.color ?? null,
    inputType: "pill",
  },
  {
    label: "Size/Age",
    fieldKey: "age",
    currentValue: targetCat.age ?? null,
    newValue: newCat.age ?? null,
    inputType: "pill",
  },
  {
    label: "Sex",
    fieldKey: "sex",
    currentValue: targetCat.sex ?? null,
    newValue: newCat.sex ?? null,
    inputType: "pill",
  },
  {
    label: "Sociability",
    fieldKey: "sociability",
    currentValue: targetCat.sociability ?? null,
    newValue: newCat.sociability ?? null,
    inputType: "pill",
  },
  {
    label: "Status",
    fieldKey: "cat_status",
    currentValue: targetCat.cat_status ?? null,
    newValue: newCat.cat_status ?? null,
    inputType: "pill",
  },
  {
    label: "Condition",
    fieldKey: "condition",
    currentValue: targetCondition,
    newValue: newCondition,
    inputType: "pill",
  },
  {
    label: "Photo",
    fieldKey: "photo_url",
    currentValue: targetCat.photo_url ?? null,
    newValue: newCat.photo_url ?? null,
    inputType: "image",
  },
  {
    label: "Notes",
    fieldKey: "notes",
    currentValue: targetCat.notes ?? null,
    newValue: newCat.notes ?? null,
    inputType: "textarea",
  },
];
```

- [ ] **Step 2: Update diff partition to count image fields as auto-merge eligible**

Still in `buildMergeDiff`, replace the `pillCandidates`/`diffFields`/`autoMergedCount` block (currently line 98-105) with:

```tsx
const choiceCandidates = candidates.filter(
  (f) => f.inputType === "pill" || f.inputType === "image",
);
const diffFields = [
  ...choiceCandidates.filter((f) => f.currentValue !== f.newValue),
  ...candidates.filter((f) => f.inputType === "textarea"),
];
const autoMergedCount = choiceCandidates.filter(
  (f) => f.currentValue === f.newValue,
).length;
```

- [ ] **Step 3: Wire `name` and `photo_url` into the `editCat` payload**

In `handleMerge` (around line 217-244), add these two blocks alongside the existing per-field assignments (right after the `if (resolved.color !== undefined)` block is a fine spot):

```tsx
if (resolved.name !== undefined)
  updatePayload.name = (resolved.name as SelectCat["name"]) ?? undefined;
if (resolved.photo_url !== undefined)
  updatePayload.photo_url =
    (resolved.photo_url as SelectCat["photo_url"]) ?? undefined;
```

- [ ] **Step 4: Pass photo header props into `MergeDetailsDialog`**

Replace the `<MergeDetailsDialog ... />` JSX (currently line 627-635) with:

```tsx
<MergeDetailsDialog
  open={showMergeConfirm}
  onClose={() => setShowMergeConfirm(false)}
  targetName={mergeTargetCat?.name ?? null}
  newName={cat?.name ?? null}
  newPhotoUrl={cat?.photo_url ?? null}
  targetPhotoUrl={mergeTargetCat?.photo_url ?? null}
  diffFields={mergeDiffFields}
  autoMergedCount={mergeAutoMergedCount}
  onMerge={handleMerge}
  isLoading={saving}
/>
```

- [ ] **Step 5: Type-check the whole project**

Run: `pnpm tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 6: Commit**

```bash
git add components/app-pages/sessions/session-dialogs.tsx components/app-pages/sessions/sessions-approval-crossref-screen.tsx docs/superpowers/plans/2026-05-25-merge-name-photo.md
git commit -m "feat(sessions): merge dialog handles name and photo conflicts"
```

---

## Self-Review Notes

- **Spec coverage:** name in diff (Task 3 step 1), photo_url in diff as image (Task 3 step 1), always-visible photo header for visual confirmation (Task 1 step 4), dead readonly removed (Task 1 step 5). Multi-photo explicitly skipped per user.
- **Placeholders:** none — every step has exact code.
- **Type consistency:** `MergeFieldDef.inputType` updated to `"pill" | "textarea" | "image"` in Task 1; Task 2 splits accordingly; Task 3 emits matching values. `editCatSchema` already accepts `name` and `photo_url` (verified in `lib/validation/cats.ts:33-37`).
- **No tests:** project has no component test setup for these screens; `pnpm tsc --noEmit` is the verification per `CLAUDE.md` ("Don't run `pnpm dev` to verify… Trust the code").
