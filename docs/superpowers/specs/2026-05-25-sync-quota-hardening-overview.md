# Sync Quota Hardening — Plain-English Overview

**Date:** 2026-05-25
**Companion to:** [Design Spec](./2026-05-25-sync-quota-hardening-design.md)

## What's broken

Every 10 minutes a Cloudflare Worker pings our `/api/cron/sync` endpoint. That kicks off a background job that talks to Google Sheets to:

1. Pull any pasted photos from the catalog spreadsheet into Supabase storage.
2. Push DB changes into the relevant region tabs.
3. Regenerate the "For RI" and "For FA" summary sheets.

Google limits each Google account ("service account" in our case) to **60 read requests per minute** on the Sheets API. Our cron tick currently fires ~37+ reads in a tight burst — one per region — because the photo-import phase scans every region's edit-timestamp column to look for new photos. We blow past 60 within the first minute, Google says no, and the sync audit log fills up with quota errors.

A few related issues we found while digging:

- The cron is supposed to do reverse-sync (pull manual edits from sheets back into the DB), but it doesn't — the reverse-sync code on the cron path is dead, never called.
- When Google says "rate limited," our code panics and auto-freezes the entire sync system. Rate limits are temporary; freezing the whole system for a 1-second hiccup is too aggressive.
- Photo-import failures are silently logged. Nothing in Discord, nothing visible. Issues hide.

## What we're changing

Three things, layered:

### 1. A single "Sheets client" that knows the rules

Right now every Sheets call goes straight to Google with no safety net. We're introducing one shared wrapper that **every** Sheets call has to go through. The wrapper does two things:

- **Spaces calls out by ~1.2 seconds.** No call goes out until 1.2s after the last one. Boring, predictable, keeps us comfortably under 60/min.
- **Retries when Google says "slow down."** If we get a 429 (rate limit) or 5xx (server hiccup), the wrapper waits 1s, then 2s, then 4s, then gives up. Most transient errors heal themselves and never reach the rest of the code.

This single change removes the bulk of the quota errors and stops the panic-freezes on transient failures.

### 2. Read everything once, share it

The cron currently reads each region's sheet state inside photo-import. Then later, if we'd done reverse-sync (we don't, but we will), it would read everything again. Then `clearSheetEditTimestamps` re-reads col Y per region for row positions. Lots of redundant reads.

We're replacing all that with **one read pass at the start of the cron**: a `Map<regionId, SheetRow[]>` covering all 37 regions, paced through the wrapper. Photo-import uses it. Reverse-sync uses it. The clear-timestamps step uses row positions captured during this initial read, so it doesn't re-read at all.

Same total quota cost as today, but cleaner code and reverse-sync now runs essentially for free.

### 3. Cron actually runs reverse-sync now

Today the cron only does photo-import + forward-sync + summary regen. Manual edits in the Google Sheet only get imported into the DB if someone happens to open that region in the app (which triggers `syncRegion`... which, it turns out, is also dead code, but that's a separate cleanup).

After this change, the cron loops through every region that has a non-empty col W (the "last edited" timestamp Apps Script writes when someone touches the sheet), and pulls those edits into the DB on every cycle. Manual sheet edits will now propagate within 10 minutes automatically.

## What changes for users

**Nothing visible**, with one exception:

- **Admin "unfreeze" button** will take ~45-90 seconds instead of ~10s, because it does a full reverse-sync of all 37 regions and now paces every Sheets call. It's a rare action (only after a freeze) and we'll add a loading indicator.

UI write paths are unaffected. They never touched Sheets directly — they just write to a queue in our DB, and the cron drains the queue. Same as today.

## What changes for failures

- **Quota errors → invisible.** The wrapper retries them silently. They no longer appear in the audit log and no longer auto-freeze sync.
- **Photo-import errors → Discord alert.** Today they're swallowed. After: visible, but they don't freeze sync (photos are non-critical).
- **Real persistent errors (something genuinely broken) → still auto-freeze.** The wrapper exhausts its retries first, then propagates the error to the cron route, which freezes and alerts Discord like before.

## Dead code being removed

- `syncRegion(regionId)` in `app/actions/google-sheets.ts` — leftover from earlier design, no callers.
- `reverseSyncRegion(regionId)` (the public wrapper) in `reverse-sync.service.ts` — only consumer was `syncRegion`.

Both deleted as part of this PR.

## What's NOT changing

- Cron interval — stays 10 minutes.
- Auto-freeze policy — still happens on real errors, just not on transient ones.
- Forward-sync logic — same queue-based approach, same conflict resolution.
- Photo-import xlsx parsing — same approach (it works, just gets paced reads now).
- Schema, env vars, dependencies — none.

## Why this works at our scale

- 37 regions × 1.2s pacing = ~45s for the read phase. Vercel function timeout is 300s, cron window is 600s. Plenty of room.
- Google's per-minute quota refills every minute. Pacing at <50 reads/min guarantees we never hit it.
- The 3-retry exponential backoff (1s/2s/4s = 7s max) gives Google plenty of time to recover from transient blips without us giving up.

The system is fundamentally well-designed — queue-based forward sync, timestamp-based conflict resolution, freeze-on-error safety, dedicated photo-import phase. This PR is operational hygiene, not a redesign.
