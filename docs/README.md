# Documentation

Start with **[/CLAUDE.md](../CLAUDE.md)** — the agent-facing guide covering conventions,
invariants, and the design system. Everything here is the deeper layer beneath it.

## Map

| Path                                                       | Audience        | What it is                                                    |
| ---------------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| [architecture/sync-engine.md](architecture/sync-engine.md)  | dev / agent     | Column contract, cron phases, conflict rules, invariants      |
| [architecture/data-model.md](architecture/data-model.md)    | dev / agent     | Schema, lifecycles, effective region, nullable-by-design      |
| [architecture/frontend.md](architecture/frontend.md)        | dev / agent     | Two-screen (mobile/desktop) strategy                          |
| [specs/](specs/)                                            | dev / agent     | **Active** design specs awaiting or under implementation      |
| [operations/gsheets-sync-setup.md](operations/gsheets-sync-setup.md) | operator | Sync setup + runbook: provisioning, cutover, recovery         |
| [operations/handoff.md](operations/handoff.md)              | operator        | Moving the accounts to AGILA ownership — one-time runbook      |
| [operations/decommissioning.md](operations/decommissioning.md) | operator | Retiring the sync: killswitch, cron teardown, Apps Script cleanup |
| [handbook/AGILA-User-Manual.md](handbook/AGILA-User-Manual.md) | end user    | Non-technical manual, split by role                           |
| [reference/](reference/)                                    | context         | Original proposal + CATalog spreadsheet exports               |
| [archive/](archive/)                                        | historical      | Point-in-time plans and specs — **not current truth**         |

## Where to look, by task

- **Touching sync, the queue, or anything sheet-shaped** → `architecture/sync-engine.md` first.
  It documents several deliberate-looking oddities that fix real bugs; the Jest suite encodes
  them.
- **Changing the schema, region routing, or a lifecycle** → `architecture/data-model.md`.
- **Building UI** → `CLAUDE.md` for the design system, `architecture/frontend.md` for the
  mobile/desktop split.
- **Running or repairing the sync in production** → `operations/gsheets-sync-setup.md`.
- **Transferring the accounts to AGILA** → `operations/handoff.md`. Read the domain
  section first — it is the step that makes the other three safe.
- **Understanding *why* something exists** → `archive/`, then `reference/project-proposal.md`.

## Notes on `reference/`

- `project-proposal.md` — the original proposal (Feb 2026). Useful for intent and constraints.
  **Caveat:** it is ~450 KB because the wireframes are embedded as base64; the prose is lines
  **1–186** and the rest is image data. Read it with a line limit, or open the `.pdf` alongside
  it for the figures.
- `catalog-sheets/` — real exports of the CATalog spreadsheet (`HOME`, `For RI`, `For FA`, a
  sample region tab, and `UNKNOWN`). These are the ground truth for the column contract; check
  them before assuming a layout.

Both describe the system as proposed and as it looks in the sheet — where they disagree with
the code, **the code wins.** Known drift: the proposal specifies an `@student.ateneo.edu` domain
restriction for sign-in; the implementation uses an admin-managed allowlist
(`allowed_emails`) instead.
