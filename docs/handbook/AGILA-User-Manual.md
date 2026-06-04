# AGILA CATalog — User Manual

A guide to using the AGILA CATalog app, written for the people who use it every day.
You do **not** need to know anything technical to use this manual.

> **Developers only:** setup, deployment, and how the Google Sheets sync works under the
> hood live in [`../gsheets-sync-setup-guide.md`](../gsheets-sync-setup-guide.md) — not here.
> Nothing in this manual requires a developer, a terminal, or code.

---

## Who this manual is for

The app has three kinds of users. Each one can do everything the one before it can, **plus more**:

| Role              | What they do                                                                                  | Where to read                    |
| ----------------- | --------------------------------------------------------------------------------------------- | -------------------------------- |
| **Volunteer**     | Go out, count cats, log them in census sessions                                               | [Part 1](#part-1--volunteer)     |
| **Manager**       | All of the above, plus review and approve what volunteers submit, and manage the cat database | [Part 2](#part-2--manager)       |
| **Administrator** | All of the above, plus manage people, regions, and the Google Sheets connection               | [Part 3](#part-3--administrator) |

Each Part is **self-contained** — it repeats what the roles before it cover. If you are a
volunteer, you only ever need Part 1. If you are an administrator, Part 3 has everything.

---

## The one big idea (read this first)

The **app is the primary, authoritative place to manage cats.** The Google Sheets that some
people are used to are kept in **two-way sync** with the app:

- **The app updates the sheet.** Anything you add or change in the app appears in the
  matching Google Sheet automatically, every few minutes.
- **The sheet can update the app.** Edits made directly in the sheet (by someone with edit
  access) flow _back_ into the app on the next sync. If the same cat was changed in both
  places, the **most recent edit wins**.

So the sheet is a **live mirror you can also write to** — not a passive copy, and not truly
read-only.

**The guidance for everyone is still simple: do your work in the app.**

- The app is the intended, safest way to add and edit cats. It checks your input and keeps
  everything consistent.
- Editing the spreadsheet directly is a **manager fallback** for emergencies (see Part 2) —
  not the normal workflow.
- **Volunteers** are given **view-only** access to the sheet, so for them it's just for
  looking — all their work happens in the app anyway.

If you remember one thing: **the app is the authority; the sheet stays in step with it both
ways, but routine work belongs in the app.**

---

## Glossary

Plain-language definitions of words used throughout this manual.

| Term                       | What it means                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Cat / entry**            | One cat's record — its photo, details, health, and location.                                                                    |
| **Census**                 | A count of the cats in an area at a point in time.                                                                              |
| **Session**                | One trip out to count cats in one location. Has a **Census No.** and a list of cats you logged.                                 |
| **Census No.**             | The automatic number given to each session, so they can be referred to in order.                                                |
| **Region / Location**      | A named zone on campus (e.g. _GATE 3_, _ARETE_). Every cat and every session belongs to one.                                    |
| **TNVR**                   | **T**rap–**N**euter–**V**accinate–**R**eturn — the program for humanely managing the cat population.                            |
| **Sociability**            | How comfortable a cat is around people: _Domesticated_, _Tame_, or _Feral_.                                                     |
| **Submitted / Unfinished** | A session you've sent for review is _Submitted_; one you're still working on is _Unfinished_.                                   |
| **Review / Merge**         | When a manager checks a submitted session and combines duplicate sightings of the same cat.                                     |
| **Sync**                   | The automatic background process that keeps the app and the Google Sheets matching — in **both** directions, every few minutes. |
| **Catalog**                | The public-facing list of cats (including which ones are adoptable).                                                            |

---

---

# Part 1 — Volunteer

As a volunteer, your job is the **census**: go to a location, find the cats, and log each
one in the app. Everything you need is in the **Sessions** tab.

> 🖼️ **Screenshot:** _The app's bottom navigation (mobile) showing the Overview, TNVR,
> Database, and Sessions tabs_ — save as `images/vol-00-nav.png`

## 1.1 Getting in

1. Open the app and tap **Sign in with Google**.
2. Choose your account.

You must be **invited first** — an administrator adds your email to the app before you can
sign in. If you sign in and see a message that you're _not onboarded_, your email hasn't
been added yet. Ask an administrator to add you (see Part 3).

> 🖼️ **Screenshot:** _The sign-in screen_ — save as `images/vol-01-signin.png`

## 1.2 What you can see

As a volunteer you have four tabs:

- **Overview** — a dashboard with totals and a **Priority Locations** list (which areas
  haven't been counted in the longest, so you know where to go next).
- **TNVR** — a statistics dashboard: how much of the cat population has been
  neutered/spayed (the **TNVR Score**), with a breakdown by sex, shown for all locations
  or one at a time.
- **Database** — every cat's full record. You can **look but not change** — the detail
  screens are read-only for volunteers.
- **Sessions** — your main workspace. This is where you run a census. ⬇️

You can also view the public **Catalog** of cats (including adoptable ones) — this is the
same list anyone can see.

## 1.3 Starting a census session

1. Go to the **Sessions** tab.
2. Tap **Create New**.
3. Choose the **Location** (region) you're counting.
4. The app creates the session and gives it a **Census No.** You're now ready to add cats.

> 🖼️ **Screenshot:** _The Sessions tab with the "Create New" button and the location picker_
> — save as `images/vol-02-create-session.png`

You don't have to finish in one sitting. A session you haven't submitted shows as
**Unfinished** in your Sessions list with a **Continue** button — tap it to pick up where
you left off.

## 1.4 Adding a cat to the session

1. Inside the session, tap the **+** button (the orange circle, bottom-right on mobile, or
   **Add entry** on desktop).
2. The **Add Entry** form opens. Fill in what you can — **every field is optional except a
   location**, and the location is already set from the session.

> 🖼️ **Screenshot:** _The Add Entry form_ — save as `images/vol-03-add-entry.png`

**The photo** (top of the form):

- Tap **Take photo** to use your camera, or **Choose file** to pick an existing picture.
- After picking, you can **drag the photo to reposition it** so the cat is centred.
- **Retake**, **File**, or **Remove** let you change your mind.

**The details:**

| Field              | Notes                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| **Name**           | Optional — a nickname if the cat has one.                                     |
| **Color**          | The cat's coat (e.g. _Calico_, _Orange Tabby_). Leave as _Unknown_ if unsure. |
| **Size / Age**     | _Neonatal_, _Kitten_, _Juvenile_, or _Adult_.                                 |
| **Sex**            | _Male_ or _Female_.                                                           |
| **Sociability**    | _Domesticated_, _Tame_, or _Feral_.                                           |
| **Condition**      | _Healthy_, _Sick_, _Injured_, or _Sick and Injured_.                          |
| **Neutered**       | _Yes_, _No_, or _Unknown_.                                                    |
| **Spot Last Seen** | Where exactly you saw it.                                                     |
| **Caretaker**      | The person who feeds/looks after it, if known.                                |
| **Notes**          | Anything else worth recording.                                                |

3. Tap **Save**.

> **If the photo fails to upload:** you'll see a message that the cat was saved but the
> photo didn't. The cat's details are safe. Tap **Retry Photo** to try again, or **Skip
> Photo** to finish without it (you can add a photo later by editing the cat).

The cat now appears as a card in the session.

## 1.5 Editing or removing a cat in the session

- **To edit:** tap the cat's card. The same form opens with its details — change what you
  need and **Save**.
- **To remove:** tap the **trash icon** on the card. This takes the cat out of this session.

> 🖼️ **Screenshot:** _A session with a few cat cards, showing the edit/remove controls_
> — save as `images/vol-04-session-cats.png`

## 1.6 Finishing the session

When you've logged every cat:

1. Tap **Finish** (mobile) or **Submit** (desktop).
2. Confirm.

The session is now **Submitted** and goes to a manager to review. You generally don't need
to touch it after this — if something needs fixing, a manager handles it during review.

> 🖼️ **Screenshot:** _The Finish/Submit confirmation_ — save as `images/vol-05-submit.png`

**To discard a session instead** (e.g. you started it by mistake): tap the **trash icon**
near the Census No. and confirm. This deletes the unfinished session.

## 1.7 Quick reference

- Count cats → **Sessions → Create New → pick location**.
- Add a cat → **+ / Add entry → fill the form → Save**.
- Photo trouble → the cat is still saved; **Retry** or **Skip**.
- Done → **Finish / Submit** (it goes to a manager).
- Started by mistake → **trash icon → discard**.
- You can always **Continue** an unfinished session later.

---

---

# Part 2 — Manager

As a manager you can do everything a volunteer can, **plus** you review and approve what
volunteers submit, and you have full control of the cat database. You're the quality gate:
volunteers gather the data, you make it official.

## 2.1 Everything a volunteer can do

A quick recap, so this Part stands on its own:

- **Sign in** with Google (you must have been invited by an administrator).
- **Run a census session:** **Sessions → Create New → pick a location**, then **+ / Add
  entry** to log each cat (photo, name, color, age, sex, sociability, condition, neutered,
  spot last seen, caretaker, notes) → **Save**. Tap a card to edit, the trash icon to
  remove. **Finish / Submit** when done; **Continue** an unfinished one later.
- **View** the Overview dashboard, the TNVR statistics, the cat Database, and the public
  Catalog.

Everything in Part 1, sections 1.3–1.6, applies to you too. The rest of this Part is what's
*new* for managers.

## 2.2 Reviewing submitted sessions

When volunteers submit sessions, the cats they logged wait for your review.

1. Go to **Sessions** and tap **Review Sessions**.
2. You'll see the **For Review** list — every cat awaiting review, with a count of how many
   are pending.

> 🖼️ **Screenshot:** _The "For Review" list with pending cats_ — save as `images/mgr-01-for-review.png`

For each cat you have two choices:

**Quick approve** — tap the **✓ (check)** button. Confirm, and the cat is accepted as-is and
added to the official database. Use this when the entry is clearly correct and not a
duplicate.

**Full review** — tap the **✎ (pencil) / Review** button to open the two-step review:

**Step 1 — Info Validation.** Correct any details the volunteer got wrong (color, age, sex,
sociability, status, caretaker, notes, location). The **Region (override)** field lets you
firmly assign the cat to a location.
- **Approve Instantly** ("New cat, Approve") — accept it as a brand-new cat.
- **Discard** — delete the entry entirely (use for junk/mistaken entries).
- **Next ›** — save your corrections and move to Step 2.

> 🖼️ **Screenshot:** _The Info Validation screen_ — save as `images/mgr-02-validation.png`

**Step 2 — Cross-Reference (check for duplicates).** The app shows existing cats (by
default, those in the same location) so you can tell whether this is a cat you already have
on record.
- If it **matches an existing cat**, tap **Merge ›** on that cat. A dialog shows the fields
  that differ — pick the correct value for each (matching fields merge automatically).
  Confirm, and the new sighting is folded into the existing record.
- If it's **genuinely new**, tap **New cat, Approve**.
- **Discard** removes it.

> 🖼️ **Screenshot:** _The Cross-Reference screen with the Merge button_ — save as `images/mgr-03-crossref.png`

Once approved or merged, the cat leaves the review queue.

## 2.3 The cat database — full control

Open the **Database** tab. Unlike volunteers (who can only look), you can add, edit, and
delete cats.

- **Add a cat directly:** tap **Add entry** (the **+**). This opens the same entry form,
  outside of any session — useful for adding a cat you already know about.
- **Delete a cat:** tap the **trash icon** on its card and confirm. This permanently removes
  it.
- **Open a cat** to see three tabs:
  - **General** — identity and details: color, age, sex, sociability, status, **Region
    (override)**, caretaker, spot last seen, notes. You can also **change the photo** and
    flip the **Adoptable** switch (which controls whether it shows in the public Catalog as
    adoptable). Edit, then **Save changes** (or **Cancel**).
  - **Medical** — **condition**, **neutered** (Yes/No/Unknown), **neuter date**, and
    **vaccination date**. Edit and **Save changes**.
  - **Interventions** — the cat's TNVR and veterinarian actions. Tap **New Intervention** to
    add one, and set each one's status (**Pending → Finished**, or **Cancelled**).

> 🖼️ **Screenshot:** _A cat's General tab in the Database, showing the Save/Cancel buttons_
> — save as `images/mgr-04-database-general.png`

The **Sheets** button on the Database screen opens the related Google Sheet in a new tab for
reference.

## 2.4 Census Report

The **Census Report** button (on the Sessions screen) opens the census report document in a
new browser tab — the shared write-up used for reporting outside the app.

## 2.5 Editing the spreadsheet directly (emergency fallback)

You — unlike volunteers — keep **edit access** to the Google Sheets. Because the sync is
**two-way**, anything you change in the sheet flows back into the app on the next sync (every
few minutes), and if the same cat changed in both places, the **most recent edit wins**.

**Use this sparingly.** The app is the safe, intended place to make changes — it validates
your input and avoids conflicts. Edit the sheet directly only when the app isn't usable and
something genuinely can't wait. A few cautions:

- Don't touch the hidden/locked columns (they're protected for a reason).
- A value the app wouldn't accept (a misspelled status, an invalid date) may be **rejected**
  when it syncs back — so stick to the same options the app offers.
- When the app is available again, go back to working in it.

---

---

# Part 3 — Administrator

As an administrator you can do everything a manager can, **plus** you manage the people, the
locations, and the Google Sheets connection. You're the only role that sees the **Admin**
tab.

## 3.1 Everything a manager (and volunteer) can do

A quick recap, so this Part stands on its own:

- **Run and review census sessions** — create sessions and log cats (Part 1), and review,
  approve, merge, or discard what volunteers submit (Part 2, section 2.2).
- **Manage the cat database** — add, edit, and delete cats across the General, Medical, and
  Interventions tabs; toggle Adoptable; change photos (Part 2, section 2.3).
- **View** the Overview dashboard and TNVR statistics, open the **Census Report**, and (in a
  pinch) make emergency edits to the spreadsheet (Part 2, section 2.5).

The rest of this Part is what's *new* for administrators: the **Admin** tab, which has three
sections — **Users & Access**, **Regions**, and **GSheet Config**.

> 🖼️ **Screenshot:** _The Admin tab showing the three sections_ — save as `images/adm-00-admin-tab.png`

## 3.2 Users & Access — managing people

This is how someone gets into the app at all: **you invite them here first.**

**To add a person:**
1. Tap **Add Entry**.
2. Enter their **email** (the Google account they'll sign in with), an optional **name**, and
   their **role** (Volunteer, Manager, or Administrator).
3. Save. They can now **Sign in with Google** using that email.

**To change someone's role:** use the **role dropdown** on their row and pick the new role.
The change takes effect immediately.

**To remove someone:** tap the **trash icon** on their row. They'll no longer be able to use
the app.

You can **search**, **filter**, and **sort** the list, which is paginated for long lists.

> 🖼️ **Screenshot:** _Users & Access with the role dropdown open_ — save as `images/adm-01-users.png`

**The three roles, in short:**

| Role | Can do |
| --- | --- |
| **Volunteer** | Run census sessions; view-only everywhere else. |
| **Manager** | All of the above + review/approve, full database control, census report. |
| **Administrator** | All of the above + this Admin tab. |

## 3.3 Regions — managing locations

A **region** is a named campus location (e.g. *GATE 3*, *ARETE*). Every cat and session
belongs to one. Adding a region here also sets up its Google Sheet automatically — no
developer needed.

- **Add a region:** tap **Add Region**, type the **name**, pick a **color**, and confirm.
- **Rename a region:** tap the **pencil**, edit the name, and **Save**. (Its sheet is renamed
  to match, so syncing keeps working.)
- **Delete a region:** tap the **trash icon**. If the region still has cats or sessions,
  you'll be asked to **type its name to confirm** — deleting it also removes the cats that
  belong *only* to that region. Empty regions delete without the extra step.

> 🖼️ **Screenshot:** _The Regions section with add/rename/delete controls_ — save as `images/adm-02-regions.png`

> ⚠️ **Never create a region by adding a tab directly in the Google Sheet.** Always add
> regions here in the app — that's the only way the sheet gets set up correctly.

## 3.4 GSheet Config — the sync, and how to recover it

This section controls the connection between the app and the Google Sheets. Most of the time
you'll never touch it — but if the sync ever stops, this is where you fix it.

### Sync status — and "the sync is Frozen"

The top of this section shows whether the sync is **Active** (green) or **Frozen** (red, with
a reason).

**What "Frozen" means:** if a sync ever fails, the app **automatically freezes** the sync to
avoid making things worse, and sends an alert (to a Discord channel, if one is set up). While
frozen, the app and the sheets stop updating each other.

**How to recover — the most important procedure in this manual:**
1. **Read the reason** shown next to the Frozen badge (and the Discord alert). It usually
   points at the cause — often a bad value someone typed into a sheet.
2. **Fix the cause** — correct the offending cell in the sheet, or the data in the app.
3. Tap **Unfreeze**. This runs a full re-sync from the sheets and then resumes normal
   syncing.
4. The status should return to **Active**.

> 🖼️ **Screenshot:** _GSheet Config showing the Frozen status, reason, and Unfreeze button_
> — save as `images/adm-03-frozen.png`

If you're not sure what the reason means or the freeze comes straight back, this is the one
situation to **ask a developer** — point them at
[`../gsheets-sync-setup-guide.md`](../gsheets-sync-setup-guide.md).

### Provision region sheets

**Provision Sheets** re-applies the correct structure to every region's sheet (headers,
protected columns, and the list of regions). It's **safe to run any time** — use it if a
sheet's layout looks wrong or after fixing something manually. It does **not** change any cat
data.

### Seed missing UUIDs

**Seed UUIDs** gives a permanent hidden ID to old sheet rows that don't have one yet, so they
can be imported. This is essentially a **one-time, first-setup** action — after go-live, new
rows get their ID automatically, and you should never need this again. Because it's
identity-related, it asks you to confirm before running.

> Provision and Seed are deliberately separate buttons: Provision is safe structural repair;
> Seed touches cat identity and is a once-at-setup step. When in doubt, only use
> **Provision**.

---

---

# Appendix — Making the PDF & adding screenshots

**Screenshots.** Throughout the manual, lines like this mark where a picture goes:

> 🖼️ **Screenshot:** _what to capture_ — save as `images/vol-01-signin.png`

Take that screenshot from the live app, save it into an `images/` folder next to this file
with the given name, then replace the placeholder line with:

```markdown
![what to capture](images/vol-01-signin.png)
```

**PDF.** Once screenshots are in, convert with any Markdown-to-PDF tool. With
[Pandoc](https://pandoc.org/):

```bash
pandoc AGILA-User-Manual.md -o AGILA-User-Manual.pdf
```