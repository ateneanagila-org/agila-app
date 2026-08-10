# Archive

Point-in-time working documents from the build. **These are history, not current truth.**

They record what was intended at a given moment. Where any of them disagrees with the code or
with `docs/architecture/`, the code wins — several were superseded within days by follow-up
work in the same directory.

Read them to answer **"why is it like this?"**, never **"how does it work now?"**

## Contents

| Directory | What's in it                                                              |
| --------- | ------------------------------------------------------------------------- |
| `plans/`  | Dated implementation plans (`YYYY-MM-DD-topic.md`), Apr–Jun 2026          |
| `specs/`  | Dated design specs written before the corresponding plan                  |
| `notes/`  | Undated QA passes, an analysis dump, and a stale UI handoff prompt        |

## Threads worth following

Most of the sync engine's odd-looking invariants were earned here:

- **GSheets sync overhaul** — `specs/2026-04-22-…-design.md` → `plans/2026-04-22-…-overhaul.md`.
  The original two-way design; where the column contract comes from.
- **Quota hardening** — the `2026-05-25-sync-quota-hardening-*` set (overview, design, testing
  rollout, plan). Why the paced/retried Sheets client and the idle early-exit exist.
- **Region override consistency** — `2026-06-03-…` spec + plan. Why the effective-region rule is
  duplicated in three places and why a region move queues a `DELETE`.
- **Catalog ID** — `plans/2026-05-27-drop-catalog-id-from-db.md`. Why the catalog number lives
  in the sheet and not the DB.
- **Photos** — `plans/2026-04-24-gsheet-photo-import.md` (xlsx parsing),
  `specs/2026-06-24-cat-photo-lightbox-crop-design.md` (crop-as-metadata),
  `specs/2026-06-24-cat-photo-storage-analysis.md` (reference-aware blob cleanup).

For the settled version of all of the above, read
[../architecture/sync-engine.md](../architecture/sync-engine.md) instead.
