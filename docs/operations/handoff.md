# Ownership handoff — moving the CATalog to AGILA

**Audience:** the person doing the transfer (today, that's the original developer) and
whoever verifies it afterwards.

**Goal:** every account the CATalog depends on ends up under AGILA's own Google account,
so the system survives the departure of any individual.

This is a one-time runbook, not a reference. For how the system *works*, read
[architecture/sync-engine.md](../architecture/sync-engine.md) and
[architecture/data-model.md](../architecture/data-model.md). For retiring the system
entirely, read [decommissioning.md](decommissioning.md).

---

## What the app depends on, and who owns it

Eight surfaces. Five are already AGILA's; three are not.

| Surface | Holds | Owner today |
| --- | --- | --- |
| **Cloudflare** | the cron Worker that drives every sync tick | AGILA |
| **Google Cloud project** | Sheets service account **and** the OAuth client sign-in uses | AGILA |
| **CATalog spreadsheet** | the org's live fallback + the bound Apps Script | AGILA |
| **Discord** | where sync alerts land | AGILA |
| **Domain** | the catalog's public URL | *(none yet — see Stage 0)* |
| **GitHub** | the source | **personal** |
| **Vercel** | the running app and all its env vars | **personal** |
| **Supabase** | Postgres **and** the `cat-photos` bucket | **personal** |

### Supabase is the one that matters

The other seven are recoverable. Lose GitHub and the code still runs; lose Vercel and you
redeploy; lose Cloudflare and you re-create a Worker from `workers/sync-cron/`.

Supabase is different, and the reason is specific: **the cat data is mirrored in the
spreadsheet, but the 505 photos are mirrored nowhere.** The sheet's column B holds
`=IMAGE()` formulas pointing back at Supabase Storage — it references the photos, it does
not contain them. If the bucket is lost, the images are gone and no amount of spreadsheet
recovery brings them back.

Treat Stage 3 with proportionate care.

---

## Why the domain comes first

It reads like a nice-to-have. It is actually the step that makes the other three safe.

Right now the catalog's public identity is `NEXT_PUBLIC_SITE_URL`, pointing at a
`*.vercel.app` URL — and that URL is a function of *whose account holds the project*.
Two things read it:

- **Google.** [`app/sitemap.ts`](../../app/sitemap.ts), [`app/robots.ts`](../../app/robots.ts),
  and the catalog pages' canonical tags are all built from it. Change it and every
  indexed URL breaks at once.
- **The cron Worker.** It stores the same target as `APP_URL` (a wrangler secret) and
  calls `/api/health` before `/api/cron/sync`. Change the Vercel URL without updating the
  Worker and sync stops.

Transfer first and buy a domain later, and both of those break **twice** — once when the
project moves, once when the domain lands. Attach the domain first and the public URL
never changes at all, no matter whose account the project sits in.

**Order: domain → GitHub → Vercel → Supabase.** Riskiest last, and each stage proves the
process before the next one starts.

---

## Before you start

- [ ] You can sign in to AGILA's Google account, and it has 2FA set up with recovery
      codes stored somewhere that is not one person's phone.
- [ ] You are an owner/admin on **both** sides of every transfer — the personal account
      and the AGILA-side org. Every platform below requires this; none of them let you
      push a project into an org you don't belong to.
- [ ] Check each platform's current transfer documentation before executing. The
      mechanics below were true when written and these products change; the
      **verification steps** are what actually matter and stay true.
- [ ] Confirm free-tier headroom on the receiving side. Supabase caps free projects per
      organisation — moving into an org that is already at its limit fails.
- [ ] Note the current sync state: Admin → GSheet Config. If sync is Frozen, find out why
      before adding a migration on top of it.
- [ ] Take a database backup you can restore from, independent of Supabase.

---

## Stage 0 — Buy and attach the domain

1. Register the domain on an account AGILA controls, not a personal one. This is a ninth
   surface; putting it on a personal card recreates the problem this runbook exists to fix.
2. Add it to the **current** Vercel project (still personal) and complete DNS verification.
3. Set `NEXT_PUBLIC_SITE_URL` and `APP_URL` in Vercel to the new domain. Redeploy.
4. Update the Worker: `wrangler secret put APP_URL` with the new domain.

**Verify before moving on:**

- [ ] `https://<domain>/robots.txt` returns the new host in its `Sitemap:` line.
- [ ] `https://<domain>/sitemap.xml` lists catalog URLs on the new host.
- [ ] A catalog detail page's canonical tag points at the new host.
- [ ] Wait one cron interval (20 min) and confirm a successful tick — no Discord alert.

**Rollback:** revert the two env vars and the Worker secret to the `.vercel.app` URL.
Nothing is destroyed at this stage.

---

## Stage 1 — GitHub

1. Transfer the repository to AGILA's GitHub organisation.
2. Install the Vercel GitHub App on the AGILA org and grant it access to the repo, so the
   still-personal Vercel project can keep building.

**Verify:**

- [ ] Push a trivial commit and confirm Vercel builds and deploys it.
- [ ] Branch protection and any Actions still behave as before.

**Rollback:** transfer the repo back. GitHub keeps redirects, so nothing referencing the
old path breaks immediately.

---

## Stage 2 — Vercel

1. Create (or use) a Vercel team under AGILA's Google account.
2. Transfer the project into it.
3. **Re-check every environment variable.** Do not assume they came across — compare
   against the running app's requirements and re-enter anything missing. A missing
   `SERVICE_ACCOUNT_CREDENTIALS` or `CRON_SECRET` does not fail the build; it fails the
   next sync tick.
4. Re-attach the custom domain to the project in its new home.

**Verify:**

- [ ] The site loads on the custom domain, not just the new `.vercel.app` URL.
- [ ] Sign-in works — this exercises the Google OAuth client in the AGILA Cloud project.
- [ ] `/api/health` returns healthy.
- [ ] `CRON_SECRET` in Vercel still matches the Worker's secret. If either was rotated,
      both must change together, or `/api/cron/sync` returns 401 on every tick.
- [ ] Wait one cron interval and confirm a clean tick.

**Rollback:** transfer the project back and re-attach the domain. Deployments are
immutable, so the previous build is still there.

---

## Stage 3 — Supabase

Supabase supports moving an existing project between organisations you belong to. **Try
this first** — it keeps the project reference, which means every URL and key stays valid
and there is nothing to migrate.

1. Ensure AGILA's Supabase organisation exists and you are an owner of both it and the
   source org.
2. Transfer the project.

**Verify:**

- [ ] The app still connects — load a database screen with real data.
- [ ] **Photos still render** in the catalog and the dashboard. This is the check that
      matters most.
- [ ] Sign-in still works.
- [ ] Upload one photo and confirm it lands in the bucket and displays.
- [ ] Wait one cron interval and confirm a clean tick.

### If transfer-in-place turns out to be unavailable

Then it becomes a migration to a new project, and there are three landmines. All three
are silent — the app builds and deploys fine and the damage shows up later.

**1. `cats.id` must survive byte-for-byte.** It *is* the spreadsheet's column-Y UUID —
that is the entire binding between the app and the sheet. Any import that regenerates IDs
orphans all ~558 sheet rows at once: reverse sync stops recognising them and forward sync
appends duplicates alongside. Use `pg_dump`/restore, which preserves them. A CSV round
trip through an application-level importer will not.

**2. Every `photo_url` embeds the project reference.** They are stored absolute:

```
https://<project-ref>.supabase.co/storage/v1/object/public/cat-photos/<catId>/photo.jpg
```

A new project means a new host, so all 505 photos 404 until you copy the bucket **and**
rewrite the column. Column B's `=IMAGE()` formulas rebuild from the database every tick,
so the spreadsheet's photos break too — and then self-heal once the column is corrected.

**3. Copy the bucket before rewriting the column,** not after. Rewriting first points the
app at a bucket that isn't populated yet, and the sync tick in between will propagate
broken references into the sheet.

Sign-in is the one thing that does *not* need migrating: the Google OAuth client lives in
AGILA's Cloud project, and the `allowed_emails` allowlist rides along inside the database
dump.

---

## After all four stages

- [ ] Every one of the eight surfaces is reachable from AGILA's Google account.
- [ ] Recovery codes for that account are stored where more than one officer can reach them.
- [ ] Remove the personal accounts' access — the transfer is not finished while the old
      owner is still an admin.
- [ ] Run one full cron interval and confirm a clean tick with no Discord alert.
- [ ] Run `scripts/reconcile-sheet.ts` and confirm it reports 0 absent.
- [ ] Confirm the public catalog is reachable and photos render for a signed-out visitor.

---

## Known limitations being handed over

State these plainly rather than letting the next developer discover them.

- **Reconciliation repairs presence, not content.** Phase 0.5 ensures a cat's row exists
  on the right tab. It does not verify the cells are current — forward sync only rewrites
  a row when a task is queued, so a row can hold stale values indefinitely. A clean
  `reconcile-sheet.ts` run means *rows are in the right place*, not *cells are correct*.
- **Orphan sheet rows are detected but never repaired.** `reconcile-sheet.ts` reports
  rows with no matching `Original` cat; reconciliation iterates the expected set only, so
  nothing acts on them. One-directional by design.
- **The For FA worklist infers health from absent data.** A cat with no recorded
  condition is bucketed as `Healthy & Adoptable`. Defensible — the sheet only lists cats a
  manager affirmatively marked adoptable, and the three columns are triage lanes rather
  than medical claims — but it is an inference, and it affects one cat today.
- **`cats.service.ts` issues queue statements inline** rather than through
  `lib/repo/sync-queue.repo.ts`, so `repairRegionMove` mirrors `editCat`'s supersede/DELETE
  pair by hand. The two must stay in agreement.
- **Photo blobs are not FK-linked to rows.** Cleanup is manual, via
  Admin → GSheet Config → Reclaim orphaned photos.

---

## If AGILA decides not to keep it

The system is built to be retired deliberately rather than abandoned. Do not simply stop
paying or delete accounts — that strands the spreadsheet with four columns locked by
protections and no app left to unlock them.

Follow [decommissioning.md](decommissioning.md), which releases the protections, stops the
cron, and removes the Apps Script triggers in the right order.
