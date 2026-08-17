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
| **GitHub** | the source | **personal** → an AGILA *user* account (see Stage 1) |
| **Vercel** | the running app and all its env vars | **personal** → AGILA's own Hobby account (see Stage 2) |
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
- [ ] You can sign in to both sides of every move — your account and AGILA's. Nothing here
      lets you push a project into somewhere you do not belong.
- [ ] **Check each platform's current plan limits and transfer docs before executing.**
      The free tiers are what constrain this handoff, and they change. Vercel's lack of
      free teams is what forced the shape of Stages 1 and 2; assume the next such surprise
      is waiting in Stage 3. The **verification steps** are what stay true.
- [ ] Confirm free-tier headroom on the receiving side. Supabase caps free projects per
      organisation — moving into an org already at its limit fails.
- [ ] Decide where the domain is registered *before* Stage 0, on an account AGILA controls.
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

> ### The free tier shapes both of these stages
>
> **Vercel's free (Hobby) plan has no teams** — a Hobby account is personal, full stop. So
> there is no AGILA "team" to transfer the project into, and Stages 1 and 2 below are
> written around that.
>
> Two consequences follow, and they are the reason this section exists:
>
> 1. **The repo goes to a GitHub *user* account owned by AGILA, not an organisation.**
>    Vercel Hobby has historically refused to build repositories owned by a GitHub
>    Organization, treating it as commercial use. Moving the repo to an org and only then
>    discovering that leaves it somewhere the free deploy cannot reach — worse than the
>    starting position. A user account keeps the exact shape that works today and merely
>    changes whose name is on it.
> 2. **Stage 2 is a re-deploy, not a transfer.** Vercel's project-transfer feature is built
>    around teams; do not assume Hobby-to-Hobby works. Importing the repo fresh under
>    AGILA's account is the path that does not depend on it.
>
> The cost of the user-account route is honest and worth stating: **no per-person access
> control.** Everyone with the keys shares one credential set, exactly as the Cloudflare and
> Google Cloud accounts already do. If AGILA ever funds a Vercel Pro seat (~$20/month), a
> real org plus a real team becomes available and is the better structure.

## Stage 1 — GitHub

1. Sign in to GitHub as AGILA (its own Google identity), so a user account exists to
   receive the repo.
2. Transfer the repository to that account.
3. Add whoever maintains the code as a **collaborator**, so they can push. Note this is
   also what fixes a `403 denied to <user>` on push — the credential in your keychain must
   belong to an account with write access to the repo's new home.

**Verify:**

- [ ] `git push` succeeds from a maintainer's machine.
- [ ] Any Actions still run.

**Rollback:** transfer the repo back. GitHub keeps redirects, so existing clones and links
keep working in the meantime.

---

## Stage 2 — Vercel (re-deploy, not transfer)

The old project keeps serving the site until the final step, so the visible downtime is
only the domain switch.

1. Sign in to Vercel as AGILA and **import the repo** as a new project. Match the
   production branch (`prod`).
2. **Enter all ten environment variables** from [`/.env.example`](../../.env.example).
   Nothing carries over on a fresh import. A missing `SERVICE_ACCOUNT_CREDENTIALS` or
   `CRON_SECRET` will not fail the build — it fails the next sync tick, quietly.
3. Deploy, and confirm the new project works on **its own `.vercel.app` URL** before
   touching the domain. Everything below can be checked there.
4. **Cut the domain over:** remove it from the old project, add it to the new one. A domain
   can only be attached to one project at a time, so do these back to back — this is the
   only moment the public site is down.
5. Delete the old project once the new one has served the domain cleanly for a day.

**Verify — before the domain cutover, on the new `.vercel.app` URL:**

- [ ] The site loads and the catalog renders with photos.
- [ ] Sign-in works — this exercises the Google OAuth client in the AGILA Cloud project.
- [ ] `/api/health` returns healthy.

**Verify — after the cutover:**

- [ ] The custom domain serves the new project.
- [ ] `NEXT_PUBLIC_SITE_URL` and `APP_URL` both still name the custom domain, so the
      sitemap, canonicals, and the cron Worker keep pointing at a stable address. **This is
      what Stage 0 bought:** because the public URL is the domain rather than a
      `*.vercel.app` address, changing projects does not change any URL the outside world
      or the Worker knows.
- [ ] `CRON_SECRET` in the new project matches the Worker's secret exactly. If either was
      rotated, both must change together, or `/api/cron/sync` returns 401 on every tick.
- [ ] Wait one cron interval (20 min) and confirm a clean tick with no Discord alert.

**Rollback:** re-attach the domain to the old project, which is still there and still
deployable, and investigate before retrying.

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
