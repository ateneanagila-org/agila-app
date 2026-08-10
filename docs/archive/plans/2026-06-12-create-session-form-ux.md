# Create-Session Form UX & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the high-traffic create-session form feel instant — collapse the per-cat N+1 fetch into one query, server-render the initial state, make add **and** remove optimistic (card appears/disappears immediately), fix a redundant-delete bug, and add the missing destructive-action confirm + empty-session guard.

**Architecture:** Add a single session-detail read path (`repo.findSessionCatsWithCats` → `service.getSessionWithCats` → action `getSessionWithCats`) returning the session, region name, and all cats in one authed round trip. The create page becomes a server component seeding this as props (SSR). `createSessionCat` starts returning the join-row id so the client can append the new card optimistically the moment it resolves (before the photo uploads), then reconcile in the background. The client screen drops its `getSessionCats` + N×`getCats` waterfall and the leftover duplicate `removeCat` call (orphan cleanup is now service-side). Adds `RemoveCatDialog`, an empty-session guard, and soft (`router.push`) navigation.

**Tech Stack:** Next.js App Router (server components + `next-safe-action`), Drizzle ORM, React 19, Jest. pnpm only.

**Styling/responsiveness constraint:** Do not alter card markup or layout. The screen has separate mobile (`tablet:hidden`) and desktop (`tablet:block`) card lists — every handler change must be applied to BOTH. The only new UI (`RemoveCatDialog`) reuses the existing `Shell`/`Header` dialog primitives, so it inherits responsive sizing and brand styling automatically. No new colors, fonts, or hardcoded hex.

---

## File Structure

- `lib/repo/cats.repo.ts` — export the private `catReadColumns` + `regionSubquery` for reuse.
- `lib/repo/sessions.repo.ts` — `findSessionCatsWithCats(sessionId)` (one join); `insertSessionCat` now returns `{ id }`.
- `lib/services/sessions.service.ts` — `getSessionWithCats(sessionId)`; `createSessionCat` now returns `{ cat, sessionCatId }`.
- `app/actions/sessions.ts` — new `getSessionWithCats` action.
- `components/app-pages/shared/cat-entry-form.tsx` — read the new `createSessionCat` shape; pass the created entry to `onSave`.
- `app/(protected)/dashboard/sessions/create/page.tsx` — server component seeds `initialData`.
- `components/app-pages/sessions/sessions-create-screen.tsx` — single fetch, optimistic add + remove, drop redundant `removeCat`, confirm-on-remove, empty guard, soft nav.
- `components/app-pages/sessions/session-dialogs.tsx` — `RemoveCatDialog`.
- `__tests__/services/sessions-detail.test.ts` — tests for `getSessionWithCats`.
- `__tests__/actions/sessions.test.ts` — update `createSessionCat` tests for the new return shape.

---

### Task 1: Export shared cat read shape from cats.repo

**Files:**
- Modify: `lib/repo/cats.repo.ts:16` (regionSubquery), `lib/repo/cats.repo.ts:29` (catReadColumns)

- [ ] **Step 1: Export the two consts** — add `export` to both declarations (no body change):

```ts
export const regionSubquery = sql<string | null>`COALESCE(
```
```ts
export const catReadColumns = {
```

- [ ] **Step 2: Verify** — Run: `pnpm tsc --noEmit` — Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/repo/cats.repo.ts
git commit -m "refactor: export cat read columns + region subquery for reuse"
```

---

### Task 2: Add findSessionCatsWithCats + make insertSessionCat return its id

**Files:**
- Modify: `lib/repo/sessions.repo.ts` (imports; `insertSessionCat`; new `findSessionCatsWithCats`)

- [ ] **Step 1: Add import** — below the existing `import { createEQFilters } from "./helper.repo";`:

```ts
import { catReadColumns, regionSubquery, type CatWithRegion } from "./cats.repo";
```

- [ ] **Step 2: Make insertSessionCat return its id** — replace the current `insertSessionCat` (`lib/repo/sessions.repo.ts:99-100`):

```ts
export const insertSessionCat = (data: InsertSessionCat, client: DB = db) =>
  client.insert(sessionCats).values(data).returning({ id: sessionCats.id });
```

- [ ] **Step 3: Add the join loader + row type** — insert after `deleteSessionCat` (`lib/repo/sessions.repo.ts:102-103`):

```ts
export type SessionCatRow = CatWithRegion & { session_cat_id: string };

// All cats in a session, region-resolved, with their join-row id — in one query.
// Replaces the client's getSessionCats + N×getCats waterfall on the create form.
export const findSessionCatsWithCats = (
  sessionId: string,
  client: DB = db,
): Promise<SessionCatRow[]> =>
  client
    .select({
      ...catReadColumns,
      region_name: regionSubquery,
      session_cat_id: sessionCats.id,
    })
    .from(sessionCats)
    .innerJoin(cats, eq(cats.id, sessionCats.cat_id))
    .where(eq(sessionCats.session_id, sessionId));
```

- [ ] **Step 4: Verify** — Run: `pnpm tsc --noEmit` — Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/repo/sessions.repo.ts
git commit -m "feat: findSessionCatsWithCats loader; insertSessionCat returns id"
```

---

### Task 3: createSessionCat returns { cat, sessionCatId } (TDD)

**Files:**
- Modify: `lib/services/sessions.service.ts` (`createSessionCat`)
- Modify: `__tests__/actions/sessions.test.ts` (createSessionCat suite + a mock default)

- [ ] **Step 1: Update the failing tests first**

In `__tests__/actions/sessions.test.ts`, change the `insertSessionCat` mock default (currently line 69) from:

```ts
  mockInsertSessionCat.mockResolvedValue(undefined);
```
to:
```ts
  mockInsertSessionCat.mockResolvedValue([{ id: "sc1" }]);
```

Then replace the first test in the `describe("createSessionCat", ...)` block (currently lines 149-152, "returns the newly created cat") with:

```ts
  it("returns the created cat with its session-cat join id", async () => {
    const result = await createSessionCat({ session_id: "s1", name: "Mango" } as never);
    expect(result).toEqual({
      cat: { id: "c1", name: "Pesto" },
      sessionCatId: "sc1",
    });
  });
```

(The "links the cat to the session" and "rejects adding ... finished session" tests stay as-is.)

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm jest __tests__/actions/sessions.test.ts -t "createSessionCat"`
Expected: FAIL — current service returns `newCat`, not `{ cat, sessionCatId }`.

- [ ] **Step 3: Update the service**

In `lib/services/sessions.service.ts`, replace `createSessionCat` (`lib/services/sessions.service.ts:86-106`):

```ts
export const createSessionCat = async (data: CreateSessionCatSchema) => {
  return await db.transaction(async (tx) => {
    const { session_id, ...newCatData } = data;

    const session = await sessionsRepo.findSessionById(session_id, tx);
    if (!session) throw new AppError("Session not found.", 404);
    if (session.is_finished) throw new AppError(SESSION_LOCKED_MSG, 409);

    const newCat = await createCat(newCatData);

    const [join] = await sessionsRepo.insertSessionCat(
      {
        session_id: session_id,
        cat_id: newCat.id,
      },
      tx,
    );

    return { cat: newCat, sessionCatId: join.id };
  });
};
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm jest __tests__/actions/sessions.test.ts`
Expected: PASS (all createSessionCat + sibling suites green).

- [ ] **Step 5: Commit**

```bash
git add lib/services/sessions.service.ts __tests__/actions/sessions.test.ts
git commit -m "feat: createSessionCat returns cat + session-cat join id"
```

---

### Task 4: Add getSessionWithCats service (TDD)

**Files:**
- Modify: `lib/services/sessions.service.ts` (import + new function)
- Test: `__tests__/services/sessions-detail.test.ts`

- [ ] **Step 1: Write the failing test** — create `__tests__/services/sessions-detail.test.ts`:

```ts
jest.mock("@/lib/repo/sessions.repo", () => ({
  findSessionById: jest.fn(),
  findSessionCatsWithCats: jest.fn(),
}));
jest.mock("@/lib/repo/regions.repo", () => ({
  findRegionById: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  db: { transaction: jest.fn() },
  Transaction: class {},
}));
jest.mock("@/lib/services/cats.service", () => ({
  createCat: jest.fn(),
  removeCat: jest.fn(),
}));

import { getSessionWithCats } from "@/lib/services/sessions.service";
import * as sessionsRepo from "@/lib/repo/sessions.repo";
import * as regionsRepo from "@/lib/repo/regions.repo";

const mockFindSessionById = sessionsRepo.findSessionById as jest.Mock;
const mockFindSessionCatsWithCats =
  sessionsRepo.findSessionCatsWithCats as jest.Mock;
const mockFindRegionById = regionsRepo.findRegionById as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFindSessionById.mockResolvedValue({
    id: "s1", region_id: "R-1", is_finished: false, census_no: 7,
  });
  mockFindRegionById.mockResolvedValue({ id: "R-1", name: "North Block" });
  mockFindSessionCatsWithCats.mockResolvedValue([
    { id: "c1", name: "Mango", session_cat_id: "sc1", region_name: "North Block" },
    { id: "c2", name: "Pesto", session_cat_id: "sc2", region_name: "North Block" },
  ]);
});

describe("getSessionWithCats", () => {
  it("returns null when the session does not exist", async () => {
    mockFindSessionById.mockResolvedValueOnce(undefined);
    const result = await getSessionWithCats("nope");
    expect(result).toBeNull();
    expect(mockFindSessionCatsWithCats).not.toHaveBeenCalled();
  });

  it("returns session, resolved region name, and shaped cat entries", async () => {
    const result = await getSessionWithCats("s1");
    expect(result).toEqual({
      session: { id: "s1", region_id: "R-1", is_finished: false, census_no: 7 },
      regionName: "North Block",
      cats: [
        { cat: expect.objectContaining({ id: "c1", name: "Mango" }), sessionCatId: "sc1" },
        { cat: expect.objectContaining({ id: "c2", name: "Pesto" }), sessionCatId: "sc2" },
      ],
    });
  });

  it("strips session_cat_id out of the nested cat object", async () => {
    const result = await getSessionWithCats("s1");
    expect(result?.cats[0].cat).not.toHaveProperty("session_cat_id");
  });

  it("returns null region name when the session has no region", async () => {
    mockFindSessionById.mockResolvedValueOnce({ id: "s1", region_id: null });
    mockFindSessionCatsWithCats.mockResolvedValueOnce([]);
    const result = await getSessionWithCats("s1");
    expect(result?.regionName).toBeNull();
    expect(mockFindRegionById).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `pnpm jest __tests__/services/sessions-detail.test.ts` — Expected: FAIL (`getSessionWithCats is not a function`).

- [ ] **Step 3: Implement**

In `lib/services/sessions.service.ts`, add to imports (after the `import * as sessionsRepo from "../repo/sessions.repo";` line):

```ts
import * as regionsRepo from "../repo/regions.repo";
```

Add after `createSession` (before `finishSession`):

```ts
/**
 * Single-round-trip loader for the create form: the session, its region's
 * display name, and all its cats (region-resolved) shaped as { cat, sessionCatId }.
 * Returns null when the session is missing. Replaces the client-side
 * getSessionCats + N×getCats waterfall.
 */
export const getSessionWithCats = async (sessionId: string) => {
  const session = await sessionsRepo.findSessionById(sessionId);
  if (!session) return null;

  const region = session.region_id
    ? await regionsRepo.findRegionById(session.region_id)
    : null;

  const rows = await sessionsRepo.findSessionCatsWithCats(sessionId);
  const cats = rows.map(({ session_cat_id, ...cat }) => ({
    cat,
    sessionCatId: session_cat_id,
  }));

  return { session, regionName: region?.name ?? null, cats };
};
```

- [ ] **Step 4: Run test to verify it passes** — Run: `pnpm jest __tests__/services/sessions-detail.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/services/sessions.service.ts __tests__/services/sessions-detail.test.ts
git commit -m "feat: getSessionWithCats service (single-call session loader)"
```

---

### Task 5: Add getSessionWithCats server action

**Files:**
- Modify: `app/actions/sessions.ts`

- [ ] **Step 1: Add the action** — after the `getSessions` action (currently ends line 38):

```ts
// Single authed call returning the session, its region name, and all its cats.
// Replaces getSessionCats + per-cat getCats on the create form (kills the N+1).
export const getSessionWithCats = actionClient
  .schema(z.object({ session_id: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    await requireAuth();
    return await service.getSessionWithCats(parsedInput.session_id);
  });
```

(`z`, `requireAuth`, `service` already imported.)

- [ ] **Step 2: Verify** — Run: `pnpm tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/actions/sessions.ts
git commit -m "feat: getSessionWithCats action"
```

---

### Task 6: Add RemoveCatDialog (reuses existing dialog primitives)

**Files:**
- Modify: `components/app-pages/sessions/session-dialogs.tsx`

- [ ] **Step 1: Add the dialog** — after `DeleteSessionDialog` (currently ends line 245):

```tsx
// ─── Remove Cat Dialog ────────────────────────────────────────────────────────

type RemoveCatDialogProps = {
  open: boolean;
  catName: string | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function RemoveCatDialog({
  open,
  catName,
  onClose,
  onConfirm,
  isLoading,
}: RemoveCatDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Remove cat?" onClose={onClose} />
      <p className="text-sm text-foreground">
        {catName ? `“${catName}” will be` : "This entry will be"} permanently
        removed from the session. This action cannot be undone.
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Cancel <span>✕</span>
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Removing..." : "Remove"} <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </Shell>
  );
}
```

(`Shell`, `Header`, `TrashIcon` already in this file. The `max-w-sm` Shell is the same responsive shell every other session dialog uses.)

- [ ] **Step 2: Verify** — Run: `pnpm tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/app-pages/sessions/session-dialogs.tsx
git commit -m "feat: RemoveCatDialog confirm dialog"
```

---

### Task 7: cat-entry-form — consume new createSessionCat shape + emit created entry

**Files:**
- Modify: `components/app-pages/shared/cat-entry-form.tsx`

- [ ] **Step 1: Widen the onSave prop type**

Replace the `onSave` prop doc/type (`components/app-pages/shared/cat-entry-form.tsx:47-48`):

```tsx
  /** Called after a successful save. For a NEW session cat, receives the created
   *  entry so the parent can append it optimistically; undefined otherwise. */
  onSave?: (added?: { cat: SelectCat; sessionCatId: string }) => void;
```

- [ ] **Step 2: Capture the created entry in the session-add branch**

In `handleSave`, the new-cat path currently (`components/app-pages/shared/cat-entry-form.tsx:228-273`) sets `newCatId` and calls `onSave?.()`. Replace that whole block — from `let newCatId ...` down to the `onSave?.();` that follows `setSavedCatId` — with:

```tsx
      let newCatId: string | undefined = savedCatId ?? undefined;
      let addedEntry: { cat: SelectCat; sessionCatId: string } | undefined;

      // Skip cat-create when retrying after a photo-upload failure.
      if (!newCatId) {
        const payload = {
          region_id: effectiveRegionId,
          condition: normalizeCatField<CatHealthRecordCondition>(condition),
          is_neutered: neuteredToValue(neutered),
          color: normalizeCatField<CatColor>(color),
          age: normalizeCatField<CatAge>(age),
          sex: normalizeCatField<CatSex>(sex),
          sociability: normalizeCatField<CatSociability>(sociability),
          spot_last_seen: spotLastSeen || undefined,
          caretaker: caretaker || undefined,
          notes: notes || undefined,
          name: name || undefined,
        };

        if (sessionId) {
          const result = await createSessionCat({
            ...payload,
            session_id: sessionId,
          });
          if (result?.serverError) {
            setError(result.serverError);
            return;
          }
          if (result?.data) {
            newCatId = result.data.cat.id;
            addedEntry = {
              cat: result.data.cat as SelectCat,
              sessionCatId: result.data.sessionCatId,
            };
          }
        } else {
          const result = await createCat(payload);
          if (result?.serverError) {
            setError(result.serverError);
            return;
          }
          const created = Array.isArray(result?.data)
            ? result.data[0]
            : result?.data;
          newCatId = (created as { id?: string } | undefined)?.id;
        }

        if (newCatId) setSavedCatId(newCatId);
        // Refresh parent list so the cat appears even if photo retry fails.
        // For a session add, hand over the entry for an optimistic insert.
        onSave?.(addedEntry);
      }
```

- [ ] **Step 3: Verify** — Run: `pnpm tsc --noEmit` — Expected: no errors. (Edit-mode and photo-retry `onSave?.()` calls remain no-arg — valid against the optional param.)

- [ ] **Step 4: Commit**

```bash
git add components/app-pages/shared/cat-entry-form.tsx
git commit -m "feat: cat-entry-form emits created entry for optimistic insert"
```

---

### Task 8: Rewire the create screen

**Files:**
- Modify: `components/app-pages/sessions/sessions-create-screen.tsx`

Apply the edits in order. **Card markup (mobile + desktop `cats.map`) is unchanged except the noted `onClick` swaps — do not restructure or re-key it.**

- [ ] **Step 1: Imports + props**

Replace the top import block (`components/app-pages/sessions/sessions-create-screen.tsx:1-26`) with:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, TrashIcon } from "@/components/app-pages/shared/icons";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";
import {
  DeleteSessionDialog,
  FinishSessionDialog,
  RemoveCatDialog,
} from "@/components/app-pages/sessions/session-dialogs";
import {
  getSessionWithCats,
  editSession,
  removeSession,
  removeSessionCat,
} from "@/app/actions/sessions";
import type { SelectCat } from "@/lib/validation/cats";

type SessionCatEntry = { cat: SelectCat; sessionCatId: string };

export type CreateSessionInitialData = {
  session: {
    id: string;
    census_no: number | null;
    region_id: string;
    is_finished: boolean | null;
  };
  regionName: string | null;
  cats: SessionCatEntry[];
} | null;

type SessionsCreateScreenProps = {
  sessionId: string | null;
  initialData: CreateSessionInitialData;
};
```

- [ ] **Step 2: Component signature, state, data-loading effects**

Replace from the function declaration through the end of the bfcache `useEffect` (`components/app-pages/sessions/sessions-create-screen.tsx:28-130`) with:

```tsx
export function SessionsCreateScreen({
  sessionId: initialSessionId,
  initialData,
}: SessionsCreateScreenProps) {
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [censusNo, setCensusNo] = useState<number | null>(
    initialData?.session.census_no ?? null,
  );
  const [selectedRegionId, setSelectedRegionId] = useState(
    initialData?.session.region_id ?? "",
  );
  const [selectedRegionName, setSelectedRegionName] = useState(
    initialData?.regionName ?? "",
  );
  const [cats, setCats] = useState<SessionCatEntry[]>(initialData?.cats ?? []);
  const [removingCatId, setRemovingCatId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SessionCatEntry | null>(
    null,
  );
  const [editingCat, setEditingCat] = useState<SelectCat | null>(null);
  // Full-screen spinner only when nothing was server-seeded.
  const [loading, setLoading] = useState(!initialData && !!initialSessionId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Single-call (re)load of the whole session: session + region + cats. */
  const loadSession = useCallback(async (sid: string, showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const result = await getSessionWithCats({ session_id: sid });
      const data = result?.data;
      if (!data) {
        setError("Session not found.");
        return;
      }
      if (data.session.is_finished) {
        // Submitted sessions are immutable. Bounce back instead of rendering a
        // stale, editable form (covers the back-button / bfcache return path).
        window.location.replace("/dashboard/sessions");
        return;
      }
      setSessionId(data.session.id);
      setCensusNo(data.session.census_no);
      setSelectedRegionId(data.session.region_id);
      setSelectedRegionName(data.regionName ?? "Unknown Location");
      setCats(data.cats as SessionCatEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // First load only when the server did NOT seed data (e.g. soft client nav).
  useEffect(() => {
    if (initialSessionId && !initialData) {
      loadSession(initialSessionId, true);
    }
  }, [initialSessionId, initialData, loadSession]);

  // bfcache: clicking "back" can restore this screen from memory without re-running
  // the load effect, leaving a stale (possibly now-submitted) form. Re-hydrate on
  // restore so the is_finished redirect fires.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && initialSessionId) {
        loadSession(initialSessionId);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [initialSessionId, loadSession]);
```

- [ ] **Step 3: handleDiscard + handleSubmitSession (soft nav) + empty guard**

Replace `handleDiscard` and `handleSubmitSession` (`components/app-pages/sessions/sessions-create-screen.tsx:132-177`) with:

```tsx
  const handleDiscard = useCallback(async () => {
    if (!sessionId) {
      router.push("/dashboard/sessions");
      return;
    }
    setDiscarding(true);
    setError(null);
    try {
      const result = await removeSession.bind(null, sessionId)();
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      router.push("/dashboard/sessions");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to discard session.",
      );
    } finally {
      setDiscarding(false);
    }
  }, [sessionId, router]);

  const handleSubmitSession = useCallback(async () => {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await editSession.bind(
        null,
        sessionId,
      )({ id: sessionId, is_finished: true });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      router.push("/dashboard/sessions");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit session.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, router]);

  // Empty sessions should not land in the manager review queue silently.
  const handleFinishClick = useCallback(() => {
    if (cats.length === 0) {
      setError("Add at least one cat before finishing the session.");
      return;
    }
    setShowFinish(true);
  }, [cats.length]);
```

- [ ] **Step 4: handleOpenAddForm + optimistic handleCatSaved + handleConfirmRemove**

Replace `handleOpenAddForm`, `handleCatSaved`, and `handleRemoveCat` (`components/app-pages/sessions/sessions-create-screen.tsx:179-211`) with:

```tsx
  const handleOpenAddForm = useCallback(() => {
    if (!sessionId) {
      setError("Select a location first to create a session.");
      return;
    }
    setShowAddForm(true);
  }, [sessionId]);

  // Optimistic add: append the returned entry immediately (card shows before the
  // photo finishes uploading), then reconcile in the background to pick up the
  // canonical row (incl. photo_url). Edit/no-entry calls just reconcile.
  const handleCatSaved = useCallback(
    (added?: SessionCatEntry) => {
      if (added) {
        setCats((prev) =>
          prev.some((c) => c.sessionCatId === added.sessionCatId)
            ? prev
            : [...prev, added],
        );
      }
      if (sessionId) loadSession(sessionId);
    },
    [sessionId, loadSession],
  );

  const handleConfirmRemove = useCallback(async () => {
    const entry = pendingRemove;
    if (!entry) return;
    setRemovingCatId(entry.sessionCatId);
    setError(null);
    // Optimistic: drop it now; restore on failure.
    setCats((prev) => prev.filter((c) => c.sessionCatId !== entry.sessionCatId));
    setPendingRemove(null);
    try {
      const result = await removeSessionCat.bind(null, entry.sessionCatId)();
      if (result?.serverError) {
        // Guard rejected (e.g. session already submitted) — restore the row.
        setCats((prev) =>
          prev.some((c) => c.sessionCatId === entry.sessionCatId)
            ? prev
            : [...prev, entry],
        );
        setError(result.serverError);
        return;
      }
      // removeSessionCat already hard-deletes the now-orphaned Unsubmitted cat
      // server-side (blob + sheet row included); no extra removeCat call here.
      if (sessionId) await loadSession(sessionId);
    } catch (err) {
      setCats((prev) =>
        prev.some((c) => c.sessionCatId === entry.sessionCatId)
          ? prev
          : [...prev, entry],
      );
      setError(err instanceof Error ? err.message : "Failed to remove cat.");
    } finally {
      setRemovingCatId(null);
    }
  }, [pendingRemove, sessionId, loadSession]);
```

- [ ] **Step 5: Point buttons at the new handlers (BOTH mobile and desktop)**

Four `onClick` swaps — leave all surrounding markup/classes intact:

Mobile Finish (around `:256`): `onClick={() => setShowFinish(true)}` → `onClick={handleFinishClick}`

Mobile remove (around `:320`): `onClick={() => handleRemoveCat(sessionCatId, cat.id)}` → `onClick={() => setPendingRemove({ cat, sessionCatId })}`

Desktop Submit (around `:403`): `onClick={handleSubmitSession}` → `onClick={handleFinishClick}`

Desktop remove (around `:481`): `onClick={() => handleRemoveCat(sessionCatId, cat.id)}` → `onClick={() => setPendingRemove({ cat, sessionCatId })}`

(Both Finish/Submit now route through `handleFinishClick` → `FinishSessionDialog` → `handleSubmitSession`, so the empty-guard + confirm apply uniformly on mobile and desktop. The `disabled={submitting}` on the desktop Submit button stays.)

- [ ] **Step 6: Mount RemoveCatDialog**

After `DeleteSessionDialog` in the dialog block (around `:502-507`):

```tsx
      <RemoveCatDialog
        open={pendingRemove !== null}
        catName={pendingRemove?.cat.name ?? null}
        onClose={() => setPendingRemove(null)}
        onConfirm={handleConfirmRemove}
        isLoading={removingCatId !== null}
      />
```

- [ ] **Step 7: Confirm CatEntryForm onSave wiring is unchanged-compatible**

The two `<CatEntryForm ... onSave={...} />` usages (around `:509-529`) already pass `handleCatSaved` (add form) and an inline `() => { setEditingCat(null); handleCatSaved(); }` (edit form). Leave them as-is — the add form's `onSave={handleCatSaved}` now receives the optional `added` entry; the edit form calls it with none. No change needed beyond confirming `handleCatSaved`'s signature accepts the optional arg (it does).

- [ ] **Step 8: Verify** — Run: `pnpm tsc --noEmit` — Expected: no errors. Fix any reference to a now-removed symbol (`getSessionCats`, `getSessions`, `getCats`, `removeCat`, `listRegions`, `fetchSessionCats`, `SelectSessionCat`, `useSearchParams`, `hydrateExistingSession`) per the compiler.

- [ ] **Step 9: Commit**

```bash
git add components/app-pages/sessions/sessions-create-screen.tsx
git commit -m "perf: single-call load, optimistic add+remove, confirm+empty guard, soft nav"
```

---

### Task 9: SSR-seed the create page

**Files:**
- Modify: `app/(protected)/dashboard/sessions/create/page.tsx`

- [ ] **Step 1: Async server component that seeds data** — replace the entire file:

```tsx
import type { Metadata } from "next";
import { SessionsCreateScreen } from "@/components/app-pages/sessions/sessions-create-screen";
import { getSessionWithCats } from "@/lib/services/sessions.service";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = { title: "Sessions — Create" };

export default async function SessionsCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { sessionId } = await searchParams;

  const initialData = sessionId
    ? await loadData(
        "Create session initial load",
        () => getSessionWithCats(sessionId),
        null,
      )
    : null;

  return (
    <SessionsCreateScreen
      sessionId={sessionId ?? null}
      initialData={initialData}
    />
  );
}
```

- [ ] **Step 2: Verify** — Run: `pnpm tsc --noEmit` — Expected: no errors (service return type matches `CreateSessionInitialData`).

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/dashboard/sessions/create/page.tsx"
git commit -m "perf: server-render create-session form initial data"
```

---

### Task 10: Full verification

- [ ] **Step 1:** Run: `pnpm tsc --noEmit` — Expected: clean.
- [ ] **Step 2:** Run: `pnpm jest __tests__/services/sessions-detail.test.ts __tests__/actions/sessions.test.ts` — Expected: all pass.
- [ ] **Step 3:** Run: `pnpm jest` — Expected: no new failures vs. baseline.
- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "test: verify create-session form UX changes"
```

---

## Self-Review

**1. Spec coverage:**
- (#1 N+1) Tasks 1–2 (join) + 4–5 (service/action), consumed in Task 8. ✓
- (#2 redundant removeCat) Task 8 Step 4 — removed from `handleConfirmRemove`. ✓
- (#3 optimistic) Add → Tasks 3 + 7 + Task 8 Step 4 (`handleCatSaved` append). Remove → Task 8 Step 4 (optimistic filter). ✓ **Cat creation now shows the card instantly.**
- (#4 SSR) Task 9 + props in Task 8 Steps 1–2. ✓
- (#5 confirm + soft nav) Tasks 6 + Task 8 Steps 3, 5, 6. ✓
- (#6 empty guard) Task 8 Step 3 (`handleFinishClick`). ✓
- Mobile responsiveness / existing styles: RemoveCatDialog reuses `Shell`/`Header`; card markup untouched; handler swaps applied to both mobile and desktop variants (Task 8 Step 5). ✓

**2. Placeholder scan:** none.

**3. Type consistency:**
- `createSessionCat` returns `{ cat, sessionCatId }` (Task 3) → consumed in cat-entry-form as `result.data.cat.id` / `result.data.sessionCatId` (Task 7) and asserted in the updated test. ✓
- `insertSessionCat` now returns `[{ id }]`; service destructures `const [join] = ...; join.id`. Test mock returns `[{ id: "sc1" }]`. ✓
- `getSessionWithCats` service shape ↔ `CreateSessionInitialData` (session narrowed to 4 fields the screen reads) ↔ page props. Action wraps as `{ data }`; screen reads `result?.data`. ✓
- `SessionCatRow = CatWithRegion & { session_cat_id }`; service strips `session_cat_id`, leaving `CatWithRegion` (superset of `SelectCat`); screen casts `data.cats as SessionCatEntry[]`. ✓
- Names `findSessionCatsWithCats` / `getSessionWithCats` / `handleCatSaved` / `handleConfirmRemove` / `handleFinishClick` / `RemoveCatDialog` used identically across tasks. ✓

**Note for the implementer:** line numbers are from the current working tree and drift as edits land — match on surrounding code, not the number.
