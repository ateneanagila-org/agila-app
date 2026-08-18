# Ownership — how the CATalog is set up, and what keeps it alive

**Status: the handover is done.** Every account the app depends on sits under AGILA's own
identity. This is the record of what that looks like and why it is arranged this way — not
a set of steps to follow.

**Read this if** you have inherited the system, you are about to change where it is hosted,
or something in the list below has expired.

For how the app *works*, read [architecture/sync-engine.md](../architecture/sync-engine.md)
and [architecture/data-model.md](../architecture/data-model.md). To retire it deliberately,
read [decommissioning.md](decommissioning.md).

---

## Confirm these once

Two facts live outside the repo and could not be verified from the code. Check them, then
delete this section:

- [ ] **The domain registrar account is AGILA's**, not an individual's. `ateneanagila.com`
      was funded personally at launch; the account holding it must be one the org controls.
- [ ] **Supabase sits under AGILA's organisation.** Everything else was confirmed live.

---

## The nine surfaces

| Surface | Holds | Loss means |
| --- | --- | --- |
| **Supabase** | Postgres **and** the `cat-photos` bucket | **photos gone permanently** — see below |
| **Domain** (`ateneanagila.com`) | the public URL, and sign-in | site keeps serving on `.vercel.app`, but login breaks |
| **Vercel** | the running app and all its env vars | redeploy from GitHub |
| **GitHub** | the source | code still runs; you just cannot ship changes |
| **Google Cloud project** | Sheets service account **and** the OAuth client | nobody can sign in, and sync dies together |
| **CATalog spreadsheet** | the org's live fallback + bound Apps Script | the fallback, not the data |
| **Cloudflare** | the cron Worker driving every sync tick | sync stops; re-create from `workers/sync-cron/` |
| **Discord** | where sync alerts land | failures become silent |

### Supabase is the one that matters

The others are recoverable. Supabase is not, and the reason is specific: **the cat data is
mirrored in the spreadsheet, but the photos are mirrored nowhere.** Column B holds
`=IMAGE()` formulas *pointing at* Supabase Storage — it references the photos, it does not
contain them. Lose the bucket and roughly 500 images are gone; no amount of spreadsheet
recovery brings them back.

If you ever take one backup of one thing, take it of the bucket.

---

## How the hosts are wired, and why

Verified live:

```
ateneanagila.com          308 →  www.ateneanagila.com
www.ateneanagila.com      200     ← primary, and what NEXT_PUBLIC_SITE_URL names
ateneanagila.vercel.app   200     ← still serving, deliberately
```

**`NEXT_PUBLIC_SITE_URL` and `APP_URL` are deliberately different. Do not "fix" this.**

| Var | Points at | Why |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://www.ateneanagila.com` | public identity — sitemap, robots, canonical tags, **and the OAuth callback** |
| `APP_URL` (Worker secret) | the `.vercel.app` URL | infrastructure — nothing about the cron should depend on a domain that can expire |

The split is the point. If the domain ever lapses, the site keeps serving and **the sync
keeps running**, because the Worker never resolves the domain. Only sign-in breaks, and
that is one env var and a redeploy away from fixed.

`www` is primary rather than the apex so auth cookies stay scoped to one host instead of
being sent to every future subdomain.

**Two things must stay in step:**

- `CRON_SECRET` in Vercel and the Worker secret must match exactly. Rotate one alone and
  every tick returns 401.
- Any origin people sign in from must be in **Supabase → Authentication → Redirect URLs**.
  `NEXT_PUBLIC_SITE_URL` feeds the OAuth `redirectTo`, and Supabase validates it.

---

## The domain will outlive whoever bought it

This is the only surface with an expiry date, and the failure mode is worse than downtime:
if `ateneanagila.com` lapses, **anyone can register it** and stand up a site carrying
AGILA's name and cat photos.

- [ ] Auto-renew is on.
- [ ] It is registered for several years, not one.
- [ ] More than one officer can reach the registrar account.

---

## Keeping it healthy

Nothing here is urgent; all of it is cheap.

| When | Do |
| --- | --- |
| Occasionally | Admin → GSheet Config: confirm sync is **Active**, not Frozen |
| Occasionally | Admin → Photo Storage: check the gauge, run **Reclaim orphaned photos** if amber |
| After a big merge or delete round | `pnpm tsx scripts/reconcile-sheet.ts` — read-only; expect 0 absent |
| Yearly | Confirm the domain renewed and 2FA recovery codes are still reachable |

A failed tick auto-freezes the sync and posts a Discord alert, so you find out without
watching. **Freeze is a pause you undo with Unfreeze. Retire is permanent** — see the manual,
section 3.3.

---

## If you ever move it again

The handover has been done once; these are the parts that were expensive to learn.

**Vercel's free plan has no teams.** A Hobby account is personal, so there is no team to
transfer a project into — the repo lives on a GitHub *user* account owned by AGILA, not an
organisation, because Vercel Hobby has historically refused to build org-owned repos. The
cost is honest: no per-person access control, one shared credential set. A Vercel Pro seat
(~$20/month) would buy a real org and a real team.

**Moving Vercel means re-importing, not transferring** — the transfer feature is built
around teams. Import the repo fresh, enter all ten variables from
[`/.env.example`](../../.env.example) (nothing carries over, and a missing
`SERVICE_ACCOUNT_CREDENTIALS` or `CRON_SECRET` fails the next sync tick rather than the
build), verify on the new `.vercel.app` URL, then move the domain across last. The domain
being separate from the Vercel URL is what makes that switch invisible to the outside world.

**Supabase should transfer in place** between organisations, which keeps the project
reference and means nothing needs migrating. If that is ever unavailable, three silent
landmines wait:

1. **`cats.id` must survive byte-for-byte.** It *is* the spreadsheet's column-Y UUID — the
   entire binding between app and sheet. An import that regenerates IDs orphans every sheet
   row at once. Use `pg_dump`/restore; a CSV round trip through an app-level importer will
   not preserve them.
2. **Every `photo_url` embeds the project reference**
   (`https://<ref>.supabase.co/storage/v1/object/public/cat-photos/<catId>/photo.jpg`), so a
   new project 404s every photo until you copy the bucket **and** rewrite the column.
3. **Copy the bucket before rewriting the column.** Reversed, the sync tick in between
   propagates broken references into the spreadsheet.

Sign-in does not need migrating: the OAuth client lives in AGILA's Cloud project, and
`allowed_emails` rides along in the database dump.

---

## Known limitations, handed over deliberately

Written down so they are inherited rather than discovered.

- **Reconciliation repairs presence, not content.** Phase 0.5 ensures a cat's row exists on
  the right tab; it does not check the cells are current. A clean `reconcile-sheet.ts` run
  means *rows are in the right place*, not *cells are correct*.
- **Orphan sheet rows are detected but never repaired.** The script reports rows with no
  matching `Original` cat; reconciliation iterates the expected set only. One-directional
  by design.
- **The For FA worklist infers health from absent data** — a cat with no recorded condition
  is bucketed `Healthy & Adoptable`. Defensible, since the sheet only lists cats a manager
  affirmatively marked adoptable and the columns are triage lanes rather than medical
  claims, but it is an inference. One cat today.
- **A merge cancels pending DELETE tasks.** `editCat`'s `Merged` branch supersedes every
  pending task for the cat with no region filter, so a merge inside the 20-minute window
  after a cross-region move can strand a row on the old tab. Latent — zero instances in the
  live data — and it lands in the orphan-row category above, which nothing repairs.
- **`cats.service.ts` issues queue statements inline** rather than through
  `lib/repo/sync-queue.repo.ts`, so `repairRegionMove` mirrors `editCat`'s supersede/DELETE
  pair by hand. The two must stay in agreement.
- **Catalog numbers leave permanent gaps.** By design — see
  [architecture/data-model.md](../architecture/data-model.md).
- **Photo blobs are not FK-linked to rows.** Cleanup is manual, via Admin → Photo Storage.

---

## If AGILA decides not to keep it

Retire it deliberately rather than abandoning it. Simply cancelling accounts strands the
spreadsheet with columns locked by protections and no app left to unlock them.

[decommissioning.md](decommissioning.md) releases the protections, stops the cron, and
removes the Apps Script triggers in the right order.
