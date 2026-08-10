# Sessions UI Consistency + Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop and mobile sessions views consistent (mobile is source of truth), fix manager-screen inconsistencies, rename DiscardSessionDialog to DeleteSessionDialog, and add a trash-icon delete button to every sessions table row.

**Architecture:** All changes are in the sessions component layer — no new routes, no new actions (removeSession already exists). The `DeleteSessionDialog` replaces `DiscardSessionDialog` everywhere. Sessions-screen and manager-screen get targeted fixes across both their mobile (`tablet:hidden`) and desktop (`tablet:block`) branches.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, pnpm. Verify via `pnpm tsc --noEmit`.

---

## File Map

| File | What changes |
|------|-------------|
| `components/app-pages/sessions/session-dialogs.tsx` | Rename `DiscardSessionDialog` → `DeleteSessionDialog`; update title text |
| `components/app-pages/sessions/sessions-create-screen.tsx` | Update import + JSX for renamed dialog |
| `components/app-pages/sessions/sessions-approval-crossref-screen.tsx` | Update import + JSX for renamed dialog |
| `components/app-pages/sessions/sessions-manager-screen.tsx` | Button colors, remove desktop search/sort, round desktop photo, H1 text |
| `components/app-pages/sessions/sessions-screen.tsx` | Imports, state, handler, remove FAB/search pill, fix colors/truncation/days, column grids, collapsed/expanded desktop, TrashIcon rows |

---

## Task 1: Rename DiscardSessionDialog → DeleteSessionDialog

**Files:**
- Modify: `components/app-pages/sessions/session-dialogs.tsx`
- Modify: `components/app-pages/sessions/sessions-create-screen.tsx`
- Modify: `components/app-pages/sessions/sessions-approval-crossref-screen.tsx`

- [ ] **Step 1: Rename the type and function in session-dialogs.tsx**

  In `session-dialogs.tsx`, find the Discard block (around line 222) and replace:

  ```tsx
  // OLD
  type DiscardSessionDialogProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
  };

  export function DiscardSessionDialog({ open, onClose, onConfirm, isLoading }: DiscardSessionDialogProps) {
    return (
      <Shell open={open} onClose={onClose}>
        <Header title="Discard session?" onClose={onClose} />
  ```

  ```tsx
  // NEW
  type DeleteSessionDialogProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
  };

  export function DeleteSessionDialog({ open, onClose, onConfirm, isLoading }: DeleteSessionDialogProps) {
    return (
      <Shell open={open} onClose={onClose}>
        <Header title="Delete session?" onClose={onClose} />
  ```

  The rest of the function body (p tag, buttons) stays unchanged.

- [ ] **Step 2: Update sessions-create-screen.tsx**

  Line 14 — update import:
  ```tsx
  // OLD
    DiscardSessionDialog,
  // NEW
    DeleteSessionDialog,
  ```

  Around line 423 — update JSX:
  ```tsx
  // OLD
        <DiscardSessionDialog
  // NEW
        <DeleteSessionDialog
  ```

- [ ] **Step 3: Update sessions-approval-crossref-screen.tsx**

  Line 12 — update import:
  ```tsx
  // OLD
    DiscardSessionDialog,
  // NEW
    DeleteSessionDialog,
  ```

  Line 574 — update JSX:
  ```tsx
  // OLD
        <DiscardSessionDialog
  // NEW
        <DeleteSessionDialog
  ```

- [ ] **Step 4: Type-check**

  ```bash
  pnpm tsc --noEmit
  ```
  Expected: no errors related to DiscardSessionDialog.

- [ ] **Step 5: Commit**

  ```bash
  git add components/app-pages/sessions/session-dialogs.tsx components/app-pages/sessions/sessions-create-screen.tsx components/app-pages/sessions/sessions-approval-crossref-screen.tsx
  git commit -m "refactor(sessions): rename DiscardSessionDialog to DeleteSessionDialog"
  ```

---

## Task 2: Fix sessions-manager-screen.tsx

**Files:**
- Modify: `components/app-pages/sessions/sessions-manager-screen.tsx`

**Changes:** button colors consistent (both dark), remove desktop search+sort section, round desktop photo, fix H1 to "For Review".

- [ ] **Step 1: Fix mobile action buttons (lines ~93–107)**

  Replace the two mobile action buttons:
  ```tsx
  // OLD
          <div className="flex gap-2">
            <a
              href={CENSUS_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-brand-green py-2.5 text-sm font-bold text-brand-green transition-opacity hover:opacity-80"
            >
              Census Report
            </a>
            <Link
              href="/dashboard/sessions"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-orange py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              My Sessions ›
            </Link>
          </div>
  ```

  ```tsx
  // NEW
          <div className="flex gap-2">
            <a
              href={CENSUS_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-dark py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Census Report
            </a>
            <Link
              href="/dashboard/sessions"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-dark py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              My Sessions ›
            </Link>
          </div>
  ```

- [ ] **Step 2: Fix desktop H1 text and action buttons (lines ~173–193)**

  Replace the desktop header block:
  ```tsx
  // OLD
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Sessions
          </h1>
          <div className="flex items-center gap-2">
            <a
              href={CENSUS_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-brand-green px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Census Report <span className="ml-1">📊</span>
            </a>
            <Link
              href="/dashboard/sessions"
              className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              My Sessions <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </div>
  ```

  ```tsx
  // NEW
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-dark">
            For Review
          </h1>
          <div className="flex items-center gap-2">
            <a
              href={CENSUS_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Census Report
            </a>
            <Link
              href="/dashboard/sessions"
              className="rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              My Sessions ›
            </Link>
          </div>
        </div>
  ```

- [ ] **Step 3: Remove the desktop search+sort section (lines ~195–212)**

  Delete the entire `<section>` block that contains the search input and Sort by button:
  ```tsx
  // DELETE this entire block:
        <section className="mt-4 overflow-hidden rounded-2xl bg-brand-green p-4 ring-1 ring-brand-green">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-white/15 px-4 pr-10 text-sm text-white outline-none placeholder:text-white/60"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            </div>
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Sort by <span className="ml-1">&#9662;</span>
            </button>
          </div>
        </section>
  ```

  Also remove the `SearchIcon` import since it's no longer used:
  ```tsx
  // OLD
  import { SearchIcon } from "@/components/app-pages/shared/icons";
  // REMOVE this line entirely
  ```

- [ ] **Step 4: Round the desktop photo (line ~228)**

  ```tsx
  // OLD
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15">
  // NEW
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15">
  ```

- [ ] **Step 5: Type-check**

  ```bash
  pnpm tsc --noEmit
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add components/app-pages/sessions/sessions-manager-screen.tsx
  git commit -m "fix(sessions): manager screen consistency - dark buttons, remove search/sort, round photo, correct title"
  ```

---

## Task 3: sessions-screen.tsx — imports, state, handler, and small fixes

**Files:**
- Modify: `components/app-pages/sessions/sessions-screen.tsx`

**Changes:** Add TrashIcon + DeleteSessionDialog + removeSession imports; add delete state + handler; remove FAB button; remove non-functional search pill; fix desktop "Review Sessions" symbol; fix desktop section heading colors; fix desktop Census No. truncation; fix desktop Priority Locations "days ago".

- [ ] **Step 1: Update imports at top of file**

  ```tsx
  // OLD
  import {
    ChevronDownIcon,
    PlusIcon,
  } from "@/components/app-pages/shared/icons";
  import {
    SessionFiltersDialog,
    SessionSortByDialog,
    CreateSessionDialog,
  } from "@/components/app-pages/sessions/session-dialogs";
  import {
    getSessions,
    getSessionCats,
    getSessionUsers,
    createSession,
  } from "@/app/actions/sessions";
  ```

  ```tsx
  // NEW
  import {
    ChevronDownIcon,
    PlusIcon,
    TrashIcon,
  } from "@/components/app-pages/shared/icons";
  import {
    SessionFiltersDialog,
    SessionSortByDialog,
    CreateSessionDialog,
    DeleteSessionDialog,
  } from "@/components/app-pages/sessions/session-dialogs";
  import {
    getSessions,
    getSessionCats,
    getSessionUsers,
    createSession,
    removeSession,
  } from "@/app/actions/sessions";
  ```

- [ ] **Step 2: Add delete state after existing state declarations (around line 57)**

  After the line `const [regionOptions, setRegionOptions] = useState<{ id: string; name: string }[]>([]);`, add:
  ```tsx
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  ```

- [ ] **Step 3: Add handleDeleteSession callback (after handleCreateSession, around line 253)**

  After the closing of `handleCreateSession`, add:
  ```tsx
  const handleDeleteSession = useCallback(async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await removeSession.bind(null, pendingDeleteId)();
      setSessions((prev) => prev.filter((s) => s.id !== pendingDeleteId));
      setPendingDeleteId(null);
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setDeleting(false);
    }
  }, [pendingDeleteId]);
  ```

- [ ] **Step 4: Remove the mobile FAB button**

  Find and delete the FAB block (around lines 551–560):
  ```tsx
  // DELETE this entire block:
        {/* FAB */}
        <div className="pointer-events-none fixed bottom-20 right-4 z-10">
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange shadow-lg transition-opacity hover:opacity-90"
          >
            <PlusIcon className="h-6 w-6 text-white" />
          </button>
        </div>
  ```

  Also remove the `PlusIcon` import since it's no longer used:
  ```tsx
  // OLD
  import {
    ChevronDownIcon,
    PlusIcon,
    TrashIcon,
  } from "@/components/app-pages/shared/icons";
  // NEW
  import {
    ChevronDownIcon,
    TrashIcon,
  } from "@/components/app-pages/shared/icons";
  ```

- [ ] **Step 5: Remove the non-functional Search pill in the mobile See All view**

  In the `showAll` branch (around lines 305–325), find and remove only the Search button:
  ```tsx
  // DELETE just this button:
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Search <span className="text-base">🔍</span>
              </button>
  ```

  The `<div className="flex flex-wrap gap-2">` and the Filter/Sort buttons stay.

- [ ] **Step 6: Fix desktop "Review Sessions" button — add ⊙ symbol**

  Find the desktop Review Sessions Link (around line 583–589):
  ```tsx
  // OLD
              <Link
                href="/dashboard/sessions/manager"
                className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Review Sessions
              </Link>
  // NEW
              <Link
                href="/dashboard/sessions/manager"
                className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Review Sessions ⊙
              </Link>
  ```

- [ ] **Step 7: Fix desktop section heading colors**

  Desktop "My Sessions" h2 (around line 612):
  ```tsx
  // OLD
            <h2 className="font-heading text-lg font-bold text-brand-dark">
              My Sessions
            </h2>
  // NEW
            <h2 className="font-heading text-lg font-bold text-brand-green">
              My Sessions
            </h2>
  ```

  Desktop "Priority Locations" h2 (around line 707):
  ```tsx
  // OLD
        <h2 className="mt-7 font-heading text-lg font-bold text-brand-dark">
          Priority Locations
        </h2>
  // NEW
        <h2 className="mt-7 font-heading text-lg font-bold text-brand-green">
          Priority Locations
        </h2>
  ```

- [ ] **Step 8: Fix desktop Census No. truncation (around line 670)**

  ```tsx
  // OLD
                    <span className="font-semibold tabular-nums">
                      {s.id.slice(0, 8)}
                    </span>
  // NEW
                    <span className="font-semibold tabular-nums">
                      {s.id.slice(0, 5)}
                    </span>
  ```

  Also fix the fallback truncation in the Location cell on the same row:
  ```tsx
  // OLD
                    <span className="truncate text-brand-dark/70">
                      {regionMap[s.region_id] ?? s.region_id.slice(0, 8)}
                    </span>
  // NEW
                    <span className="truncate text-brand-dark/70">
                      {regionMap[s.region_id] ?? s.region_id.slice(0, 5)}
                    </span>
  ```

- [ ] **Step 9: Fix desktop Priority Locations "days ago" (around line 731)**

  ```tsx
  // OLD
                    <span className="tabular-nums text-brand-dark/70">
                      {loc.daysSince === "Unknown" ? "Unknown" : `${loc.daysSince} days`}
                    </span>
  // NEW
                    <span className="tabular-nums text-brand-dark/70">
                      {loc.daysSince === "Unknown" ? "Unknown" : `${loc.daysSince} days ago`}
                    </span>
  ```

- [ ] **Step 10: Add DeleteSessionDialog at the bottom of the JSX (before the closing `</>`)** 

  After the `<CreateSessionDialog ... />` block, add:
  ```tsx
      <DeleteSessionDialog
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleDeleteSession}
        isLoading={deleting}
      />
  ```

- [ ] **Step 11: Type-check**

  ```bash
  pnpm tsc --noEmit
  ```

- [ ] **Step 12: Commit**

  ```bash
  git add components/app-pages/sessions/sessions-screen.tsx
  git commit -m "fix(sessions): add delete state/handler, remove FAB/search pill, fix desktop heading colors/truncation/days"
  ```

---

## Task 4: sessions-screen.tsx — table column layouts, desktop toggle, TrashIcon in rows

**Files:**
- Modify: `components/app-pages/sessions/sessions-screen.tsx`

**Changes:** Mobile dashboard + See All table grids updated (remove Status header, add empty action col + trash col). Desktop table grid updated (add trash col). Desktop gets collapsed/expanded toggle matching mobile behavior. TrashIcon button wired to `setPendingDeleteId` in all row locations.

### Mobile dashboard table (collapsed view — `showAll = false`)

- [ ] **Step 1: Update mobile dashboard table header grid**

  Find the header inside the "Dashboard view" branch (around line 458):
  ```tsx
  // OLD
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 border-b border-brand-dark/10 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">No.</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Location</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Date</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Status</span>
                </div>
  // NEW
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 border-b border-brand-dark/10 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">No.</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Location</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Date</span>
                  <span />
                  <span />
                </div>
  ```

- [ ] **Step 2: Replace mobile dashboard table rows**

  Find the `sessions.slice(0, 5).map(...)` block (around lines 471–499) and replace the entire map body:

  ```tsx
  // OLD
                  <div className="divide-y divide-brand-dark/8">
                    {sessions.slice(0, 5).map((s) => {
                      const st = sessionStatus(s);
                      const badgeCls =
                        st === "Reviewed"
                          ? "bg-brand-mint text-brand-green"
                          : "bg-brand-cream-dark text-brand-dark";
                      return (
                        <div key={s.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 py-2">
                          <span className="text-xs font-semibold tabular-nums text-brand-dark">
                            {s.id.slice(0, 5)}
                          </span>
                          <span className="truncate text-xs text-brand-dark/70">
                            {regionMap[s.region_id] ?? "—"}
                          </span>
                          <span className="text-xs tabular-nums text-brand-dark/70">
                            {formatDate(s.created_at)}
                          </span>
                          {st === "Unfinished" ? (
                            <Link
                              href={`/dashboard/sessions/create?sessionId=${s.id}`}
                              className="rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-bold text-white"
                            >
                              Continue ›
                            </Link>
                          ) : (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeCls}`}>
                              {st}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
  ```

  ```tsx
  // NEW
                  <div className="divide-y divide-brand-dark/8">
                    {sessions.slice(0, 5).map((s) => (
                      <div key={s.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 py-2">
                        <span className="text-xs font-semibold tabular-nums text-brand-dark">
                          {s.id.slice(0, 5)}
                        </span>
                        <span className="truncate text-xs text-brand-dark/70">
                          {regionMap[s.region_id] ?? "—"}
                        </span>
                        <span className="text-xs tabular-nums text-brand-dark/70">
                          {formatDate(s.created_at)}
                        </span>
                        {sessionStatus(s) === "Unfinished" ? (
                          <Link
                            href={`/dashboard/sessions/create?sessionId=${s.id}`}
                            className="rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-bold text-white"
                          >
                            Continue ›
                          </Link>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(s.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-brand-dark/40 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label="Delete session"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
  ```

### Mobile "See All" table (expanded view — `showAll = true`)

- [ ] **Step 3: Update mobile See All table header grid**

  Find the See All header (around line 331, inside the `showAll` branch):
  ```tsx
  // OLD
              <div className="grid grid-cols-[auto_auto_1fr_auto] gap-x-3 border-b border-brand-dark/10 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">No.</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Date</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Location</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Status</span>
              </div>
  // NEW
              <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-x-3 border-b border-brand-dark/10 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">No.</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Date</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/55">Location</span>
                <span />
                <span />
              </div>
  ```

- [ ] **Step 4: Replace mobile See All table rows**

  Find the `filteredSessions.slice(...).map((s, i) => ...)` block (around lines 346–380) and replace:

  ```tsx
  // OLD
                  <div className="divide-y divide-brand-dark/8">
                    {filteredSessions
                      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                      .map((s, i) => (
                        <div key={s.id} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-3 py-2.5">
                          <span className="text-xs font-semibold tabular-nums text-brand-dark">
                            {(page - 1) * PAGE_SIZE + i + 1}
                          </span>
                          <span className="text-xs tabular-nums text-brand-dark/70">
                            {formatDate(s.created_at)}
                          </span>
                          <span className="truncate text-xs text-brand-dark/70">
                            {regionMap[s.region_id] ?? "—"}
                          </span>
                          {(() => {
                            const st = sessionStatus(s);
                            if (st === "Unfinished") {
                              return (
                                <Link
                                  href={`/dashboard/sessions/create?sessionId=${s.id}`}
                                  className="rounded-full bg-brand-orange px-2.5 py-0.5 text-[10px] font-bold text-white"
                                >
                                  Continue ›
                                </Link>
                              );
                            }
                            const badgeCls =
                              st === "Reviewed"
                                ? "bg-brand-mint text-brand-green"
                                : "bg-brand-cream-dark text-brand-dark";
                            return (
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${badgeCls}`}>
                                {st}
                              </span>
                            );
                          })()}
                        </div>
                      ))}
                  </div>
  ```

  ```tsx
  // NEW
                  <div className="divide-y divide-brand-dark/8">
                    {filteredSessions
                      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                      .map((s, i) => (
                        <div key={s.id} className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-x-3 py-2.5">
                          <span className="text-xs font-semibold tabular-nums text-brand-dark">
                            {(page - 1) * PAGE_SIZE + i + 1}
                          </span>
                          <span className="text-xs tabular-nums text-brand-dark/70">
                            {formatDate(s.created_at)}
                          </span>
                          <span className="truncate text-xs text-brand-dark/70">
                            {regionMap[s.region_id] ?? "—"}
                          </span>
                          {sessionStatus(s) === "Unfinished" ? (
                            <Link
                              href={`/dashboard/sessions/create?sessionId=${s.id}`}
                              className="rounded-full bg-brand-orange px-2.5 py-0.5 text-[10px] font-bold text-white"
                            >
                              Continue ›
                            </Link>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(s.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-brand-dark/40 transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label="Delete session"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
  ```

### Desktop — add collapsed/expanded toggle + updated table grid

- [ ] **Step 5: Replace the entire desktop "My Sessions" section body**

  The desktop My Sessions section currently contains: a header row with Filter/Sort/Create buttons, a column header row, and the rows+paginator. Replace the content inside `<section className="mt-5 overflow-hidden rounded-2xl bg-white ring-1 ring-border">` with:

  ```tsx
        <section className="mt-5 overflow-hidden rounded-2xl bg-white ring-1 ring-border">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-heading text-lg font-bold text-brand-green">
              My Sessions
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-1 rounded-full bg-brand-cream-dark px-3.5 py-1.5 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-mint"
              >
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}{" "}
                <ChevronDownIcon className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setShowSort(true)}
                className="flex items-center gap-1 rounded-full bg-brand-cream-dark px-3.5 py-1.5 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-mint"
              >
                Sort by <ChevronDownIcon className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-1 rounded-full bg-brand-orange px-3.5 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
              >
                Create New <span>+</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto_2rem] gap-x-3 border-b border-border bg-brand-cream px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-brand-dark/60">
            <span>Census No.</span>
            <span>Date</span>
            <span>Location</span>
            <span>Status</span>
            <span />
            <span />
          </div>

          {loading ? (
            <LoadingIndicator />
          ) : sessions.length === 0 ? (
            <div className="py-10 text-center text-sm text-brand-dark/50">
              No sessions yet.
            </div>
          ) : showAll ? (
            <>
              {filteredSessions.length === 0 ? (
                <div className="py-10 text-center text-sm text-brand-dark/50">
                  No sessions match the current filters.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredSessions
                    .slice((desktopPage - 1) * PAGE_SIZE, desktopPage * PAGE_SIZE)
                    .map((s) => {
                      const st = sessionStatus(s);
                      const badgeClass =
                        st === "Reviewed"
                          ? "bg-brand-mint text-brand-green"
                          : st === "Submitted"
                            ? "bg-brand-cream-dark text-brand-dark"
                            : "bg-brand-pink text-brand-orange";
                      return (
                        <div
                          key={s.id}
                          className="grid grid-cols-[1fr_1fr_1fr_auto_auto_2rem] items-center gap-x-3 px-5 py-3 text-sm text-brand-dark"
                        >
                          <span className="font-semibold tabular-nums">{s.id.slice(0, 5)}</span>
                          <span className="tabular-nums text-brand-dark/70">{formatDate(s.created_at)}</span>
                          <span className="truncate text-brand-dark/70">{regionMap[s.region_id] ?? s.region_id.slice(0, 5)}</span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeClass}`}>
                            {st}
                          </span>
                          {st === "Unfinished" ? (
                            <Link
                              href={`/dashboard/sessions/create?sessionId=${s.id}`}
                              className="inline-flex items-center rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
                            >
                              Continue <span className="ml-0.5">&#8250;</span>
                            </Link>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(s.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-brand-dark/40 transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label="Delete session"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="text-sm font-bold text-brand-green underline underline-offset-2"
                >
                  Show less sessions
                </button>
                {filteredSessions.length > PAGE_SIZE ? (
                  <div className="flex items-center gap-1 text-xs font-semibold text-brand-dark/70">
                    <button
                      type="button"
                      onClick={() => setDesktopPage((p) => Math.max(1, p - 1))}
                      disabled={desktopPage === 1}
                      className="disabled:opacity-40"
                    >
                      ‹
                    </button>
                    <span className="mx-1 tabular-nums">
                      {(desktopPage - 1) * PAGE_SIZE + 1}–{Math.min(desktopPage * PAGE_SIZE, filteredSessions.length)} / {filteredSessions.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDesktopPage((p) => Math.min(Math.ceil(filteredSessions.length / PAGE_SIZE), p + 1))}
                      disabled={desktopPage >= Math.ceil(filteredSessions.length / PAGE_SIZE)}
                      className="disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="divide-y divide-border">
                {sessions.slice(0, 5).map((s) => {
                  const st = sessionStatus(s);
                  const badgeClass =
                    st === "Reviewed"
                      ? "bg-brand-mint text-brand-green"
                      : st === "Submitted"
                        ? "bg-brand-cream-dark text-brand-dark"
                        : "bg-brand-pink text-brand-orange";
                  return (
                    <div
                      key={s.id}
                      className="grid grid-cols-[1fr_1fr_1fr_auto_auto_2rem] items-center gap-x-3 px-5 py-3 text-sm text-brand-dark"
                    >
                      <span className="font-semibold tabular-nums">{s.id.slice(0, 5)}</span>
                      <span className="tabular-nums text-brand-dark/70">{formatDate(s.created_at)}</span>
                      <span className="truncate text-brand-dark/70">{regionMap[s.region_id] ?? s.region_id.slice(0, 5)}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeClass}`}>
                        {st}
                      </span>
                      {st === "Unfinished" ? (
                        <Link
                          href={`/dashboard/sessions/create?sessionId=${s.id}`}
                          className="inline-flex items-center rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
                        >
                          Continue <span className="ml-0.5">&#8250;</span>
                        </Link>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(s.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-brand-dark/40 transition-colors hover:bg-red-50 hover:text-red-500"
                        aria-label="Delete session"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border px-5 py-3">
                <button
                  type="button"
                  onClick={() => { setShowAll(true); setDesktopPage(1); }}
                  className="text-sm font-bold text-brand-green underline underline-offset-2"
                >
                  Show all sessions
                </button>
              </div>
            </>
          )}
        </section>
  ```

  > **Note:** The original desktop section (lines ~609–705 in the un-edited file) is fully replaced by the above. Remove the old paginator block that was outside the section (previously at lines ~698–704) since pagination is now inside the section.

- [ ] **Step 6: Type-check**

  ```bash
  pnpm tsc --noEmit
  ```
  Expected: zero errors.

- [ ] **Step 7: Commit**

  ```bash
  git add components/app-pages/sessions/sessions-screen.tsx
  git commit -m "feat(sessions): consistent table columns, desktop collapse/expand, trash-icon delete in all rows"
  ```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| Trash icon in each mobile row (dashboard + see-all) | Task 4 steps 1-4 |
| Trash icon in desktop rows | Task 4 step 5 |
| Delete confirmation modal | Task 1 (rename), Task 3 step 10 (wire) |
| Delete calls removeSession + removes from state | Task 3 steps 2-3 |
| Desktop column order matches mobile (No/Date/Location) | Task 4 step 5 |
| Mobile: no Status header, Continue in unnamed col | Task 4 steps 1-4 |
| Desktop: retain Status col | Task 4 step 5 |
| Remove mobile search pill | Task 3 step 5 |
| Remove mobile FAB | Task 3 step 4 |
| Desktop collapsed/expanded toggle | Task 4 step 5 |
| Desktop "days ago" | Task 3 step 9 |
| Desktop Census No. slice(0,5) | Task 3 step 8 |
| Desktop "Review Sessions ⊙" | Task 3 step 6 |
| Desktop section headings → text-brand-green | Task 3 step 7 |
| Manager: both buttons → bg-brand-dark | Task 2 steps 1-2 |
| Manager: remove desktop search/sort | Task 2 step 3 |
| Manager: round desktop photo | Task 2 step 4 |
| Manager: H1 "For Review" | Task 2 step 2 |
| DiscardSessionDialog renamed everywhere | Task 1 |

**Placeholder scan:** No TBDs or incomplete steps found.

**Type consistency:** `DeleteSessionDialog` defined in Task 1 and imported in Task 3 step 1. `setPendingDeleteId` added in Task 3 step 2, used in Task 4. `handleDeleteSession` defined in Task 3 step 3, passed to dialog in Task 3 step 10. All consistent.
