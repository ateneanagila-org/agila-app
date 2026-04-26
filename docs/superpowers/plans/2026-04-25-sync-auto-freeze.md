# Sync Auto-Freeze Failover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual freeze/unfreeze admin UI flow with an automated failover — the sync system self-freezes on failure, sends a Discord alert, and exposes only an Unfreeze button for admin recovery.

**Architecture:** The cron sync route's `after()` error handler becomes the freeze trigger: on any unhandled exception from `syncAllPendingRegions`, it calls `setSyncFrozen(true, reason)` and fires a Discord webhook. The freeze flag is already checked at the top of both `syncAndCompactRegion` and `reverseSyncRegion`, so subsequent cron cycles skip silently. An admin unfreezes from the app UI after investigating; unfreeze also alerts Discord that the system is back.

**Tech Stack:** Next.js App Router server actions, Drizzle ORM, Cloudflare Workers (sync-cron), Discord Webhooks

---

## File Map

| File | Change |
|---|---|
| `lib/services/system.service.ts` | Add optional `reason` param to `setSyncFrozen`; add `getSyncFreezeReason()` |
| `lib/services/discord.service.ts` | **NEW** — app-side Discord alert helper |
| `app/api/cron/sync/route.ts` | Auto-freeze + alert in `after()` catch block |
| `app/actions/system.ts` | Remove `freezeSync`; simplify `unfreezeSync`; return `reason` from `getSyncStatus` |
| `components/app-pages/users/sync-controls.tsx` | Remove Freeze button; show freeze reason; consume updated `getSyncStatus` shape |
| `workers/apps-script/Protection.gs` | Update doc comments — clarify `freezeMode`/`unfreezeMode` are now standalone manual tools, not part of auto-freeze; warn `_config!B1` is no longer auto-updated |

---

## Task 1: Add freeze reason to system.service.ts

**Files:**
- Modify: `lib/services/system.service.ts`

The `sync_freeze_reason` key in `system_config` stores why the system was frozen. Cleared on unfreeze.

- [ ] **Step 1: Update `setSyncFrozen` to accept optional reason**

Replace the entire file content:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";

export async function isSyncFrozen(): Promise<boolean> {
  const row = await db.query.systemConfig.findFirst({
    where: (cols, { eq }) => eq(cols.key, "sync_frozen"),
  });
  return row?.value === "true";
}

export async function setSyncFrozen(frozen: boolean, reason?: string): Promise<void> {
  await db
    .insert(systemConfig)
    .values({ key: "sync_frozen", value: String(frozen), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: String(frozen), updatedAt: new Date() },
    });

  if (frozen && reason) {
    await db
      .insert(systemConfig)
      .values({ key: "sync_freeze_reason", value: reason, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: reason, updatedAt: new Date() },
      });
  } else if (!frozen) {
    await db
      .delete(systemConfig)
      .where(eq(systemConfig.key, "sync_freeze_reason"));
  }
}

export async function getSyncFreezeReason(): Promise<string | null> {
  const row = await db.query.systemConfig.findFirst({
    where: (cols, { eq }) => eq(cols.key, "sync_freeze_reason"),
  });
  return row?.value ?? null;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/services/system.service.ts
git commit -m "feat: add freeze reason support to system.service"
```

---

## Task 2: Create app-side Discord alert service

**Files:**
- Create: `lib/services/discord.service.ts`

The worker already has its own `sendAlert`. This is a separate server-side helper for alerts fired from within Next.js (auto-freeze, unfreeze recovery).

- [ ] **Step 1: Create the file**

```ts
export async function sendSyncAlert(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[DiscordAlert] DISCORD_WEBHOOK_URL not set. Message:", message);
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `**[AGILA Sync Alert]** ${message}`,
      }),
    });
  } catch (error) {
    console.error("[DiscordAlert] Failed to send:", error);
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/services/discord.service.ts
git commit -m "feat: add app-side Discord alert service"
```

---

## Task 3: Auto-freeze on sync failure in cron route

**Files:**
- Modify: `app/api/cron/sync/route.ts`

On any unhandled exception from `syncAllPendingRegions`, freeze the system and fire a Discord alert. Subsequent cron cycles will hit the freeze guard at the top of `syncAndCompactRegion` / `reverseSyncRegion` and skip.

- [ ] **Step 1: Update the route**

Replace the entire file content:

```ts
import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { syncAllPendingRegions } from "@/app/actions/google-sheets";
import { setSyncFrozen } from "@/lib/services/system.service";
import { sendSyncAlert } from "@/lib/services/discord.service";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  after(async () => {
    try {
      await syncAllPendingRegions();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown sync error";
      console.error("[Cron Sync] Failed — auto-freezing:", reason);
      await setSyncFrozen(true, reason);
      await sendSyncAlert(
        `Sync auto-frozen. Reason: ${reason}. Unfreeze from the admin panel after resolving.`,
      );
    }
  });

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/sync/route.ts
git commit -m "feat: auto-freeze and discord alert on sync failure"
```

---

## Task 4: Simplify system actions

**Files:**
- Modify: `app/actions/system.ts`

Remove `freezeSync` (freeze is now automatic only). Strip sheet-protection calls from `unfreezeSync` — those are a separate concern. Add Discord alert on unfreeze. Return `reason` from `getSyncStatus`.

- [ ] **Step 1: Replace the file content**

```ts
"use server";
import {
  isSyncFrozen,
  setSyncFrozen,
  getSyncFreezeReason,
} from "@/lib/services/system.service";
import { fullReverseSync } from "@/lib/services/reverse-sync.service";
import { sendSyncAlert } from "@/lib/services/discord.service";
import {
  requireAuth,
  requireRole,
  ADMIN_ONLY,
} from "@/lib/auth/rbac";

export async function unfreezeSync() {
  await requireRole(...ADMIN_ONLY);
  const reverseSyncResult = await fullReverseSync();
  await setSyncFrozen(false);
  await sendSyncAlert("Sync manually unfrozen by admin. System resumed.");
  return { frozen: false, reverseSyncResult };
}

export async function getSyncStatus() {
  await requireAuth();
  const frozen = await isSyncFrozen();
  const reason = frozen ? await getSyncFreezeReason() : null;
  return { frozen, reason };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors in this file. There will be an error in `sync-controls.tsx` for the removed `freezeSync` import — fix that in Task 5.

- [ ] **Step 3: Commit after Task 5 passes type check (do not commit alone)**

---

## Task 5: Update SyncControls UI

**Files:**
- Modify: `components/app-pages/users/sync-controls.tsx`

Remove the Freeze button and its handler. Show the freeze reason below the status badge when frozen.

- [ ] **Step 1: Replace the file content**

```tsx
"use client";

import { useState, useEffect, useTransition } from "react";
import { unfreezeSync, getSyncStatus } from "@/app/actions/system";

export function SyncControls() {
  const [frozen, setFrozen] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getSyncStatus().then((res) => {
      setFrozen(res.frozen);
      setReason(res.reason);
    });
  }, []);

  function handleUnfreeze() {
    startTransition(async () => {
      setMessage(null);
      try {
        await unfreezeSync();
        setFrozen(false);
        setReason(null);
        setMessage("System unfrozen. Sync resumed.");
      } catch {
        setMessage("Unfreeze failed — check server logs.");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-brand-green p-4 ring-1 ring-brand-green">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-bold text-white">GSheet Sync</span>
        {frozen !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              frozen
                ? "bg-red-500/30 text-red-200"
                : "bg-green-500/30 text-green-200"
            }`}
          >
            {frozen ? "Frozen" : "Active"}
          </span>
        )}
        {isPending && (
          <span className="text-xs text-white/50">Working...</span>
        )}
      </div>

      {frozen && reason && (
        <p className="mb-3 text-xs text-red-200/80">Reason: {reason}</p>
      )}

      <button
        type="button"
        disabled={isPending || frozen === false}
        onClick={handleUnfreeze}
        className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Unfreeze
      </button>

      {message && (
        <p className="mt-2 text-xs text-white/60">{message}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit Tasks 4 and 5 together**

```bash
git add app/actions/system.ts components/app-pages/users/sync-controls.tsx
git commit -m "feat: remove manual freeze, simplify unfreeze, show freeze reason in UI"
```

---

## Task 6: Update Protection.gs comments

**Files:**
- Modify: `workers/apps-script/Protection.gs`

`freezeMode()` and `unfreezeMode()` are now fully decoupled from the app's automated failover. Update doc comments to reflect this. No functional code changes.

Two important facts to document:
1. The auto-freeze system (sync flag) does NOT touch sheet protections — `freezeMode`/`unfreezeMode` are now manual-only utilities for a separate scenario (app completely unreachable and you want volunteers to edit sheets directly).
2. `_config!B1` (authorized editors list) is **no longer auto-updated by the app** — previously the app called `syncSheetEditors()` during unfreeze to refresh this cell. Now it must be kept current manually. Before running `unfreezeMode()`, verify `_config!B1` contains the current comma-separated list of manager/admin emails.

- [ ] **Step 1: Replace the file header comment (lines 1–32)**

```js
/**
 * AGILA CATalog — Sheet Protection Toggle
 *
 * Standalone manual utilities for sheet access management.
 * These are NOT part of the automated sync failover system.
 *
 * The automated failover (auto-freeze) only pauses the sync flag in the DB —
 * it does NOT touch sheet protections. These functions are for a separate
 * scenario: the app is completely unreachable and you want users to edit
 * sheets directly until the app recovers.
 *
 * FREEZE: Removes A3:V protection so all users with sheet access can edit freely.
 * UNFREEZE: Re-locks A3:V; only authorized managers/admins can edit during normal ops.
 *
 * Authorized emails are stored in the _config sheet (B1) as a comma-separated list.
 * IMPORTANT: The app no longer auto-updates _config!B1. Before running unfreezeMode(),
 * verify that B1 contains the current list of manager/admin emails. Update it manually
 * in the _config sheet if any managers/admins have been added or removed since last run.
 *
 * Region sheet names are stored in the _config sheet (B2) as a comma-separated
 * list, managed by the app via the Sheets API. Only sheets matching a known region
 * name receive data range and UUID protections — static sheets (For RI, For FA, etc.)
 * are skipped.
 *
 * HOW TO DEPLOY:
 * 1. Open the CATalog spreadsheet -> Extensions > Apps Script
 * 2. Click + next to Files -> Script -> name it "Protection"
 * 3. Paste the contents of this file
 * 4. Click Save
 *
 * SETUP:
 * - Create a hidden, protected sheet tab named "_config" in the spreadsheet
 * - Manually enter authorized manager/admin emails as a comma-separated list in B1
 * - The app will write region sheet names as a comma-separated list to cell B2
 * - Run setupUuidProtection() once after initial spreadsheet setup
 *
 * USAGE (manual, run from Apps Script editor only):
 * - When app is completely unreachable: run freezeMode() to open sheets for direct editing
 * - After app recovery (sync resumed via app UI): run unfreezeMode() to re-lock sheets
 */
```

- [ ] **Step 2: Commit**

```bash
git add workers/apps-script/Protection.gs
git commit -m "docs: update Protection.gs to reflect auto-freeze decoupling"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| App self-freezes on sync failure | Task 3 (`after()` catch) |
| Discord alert on auto-freeze | Task 3 + Task 2 |
| Remove manual Freeze button | Task 5 |
| Keep Unfreeze button in UI | Task 5 |
| Discord alert on unfreeze | Task 4 |
| Show freeze reason in UI | Task 5 |
| Freeze reason persisted | Task 1 |
| Health check unchanged | Not touched (worker `index.ts` untouched) |
| Protection.gs decoupling documented | Task 6 |

### Type consistency check

- `setSyncFrozen(frozen: boolean, reason?: string)` defined in Task 1 → called with `(true, reason)` in Task 3, `(false)` in Task 4. ✓
- `getSyncFreezeReason(): Promise<string | null>` defined in Task 1 → called in Task 4 `getSyncStatus`. ✓
- `getSyncStatus()` returns `{ frozen: boolean, reason: string | null }` in Task 4 → consumed in Task 5 with `res.frozen` and `res.reason`. ✓
- `sendSyncAlert(message: string)` defined in Task 2 → called in Task 3 and Task 4. ✓
- `freezeSync` removed in Task 4 → import removed in Task 5. ✓

### Gaps / notes

- `DISCORD_WEBHOOK_URL` must be set in Vercel env vars for alerts to fire. The worker already uses it; this is the same var read from `process.env` on the server side.
- `unfreezeSync` no longer calls `syncSheetEditors()` or `unfreezeSheetProtections()` — sheet protection management is intentionally decoupled (separate deferred plan).
- The `freezeSheetProtections` / `unfreezeSheetProtections` / `syncSheetEditors` imports are fully removed from `system.ts`. Verify nothing else imports `freezeSync` from `system.ts` before executing (`grep -r "freezeSync" app/ components/`).
