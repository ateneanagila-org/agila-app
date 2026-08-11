/**
 * AGILA CATalog — System Column Protection
 *
 * Permanently protects the system-managed columns (A, W, X, Y) on all region sheets:
 *   A — catalog number (assigned by the system; never manually typed)
 *   W — edited_at timestamp (written by the onEdit trigger)
 *   X — editor email (written by the onEdit trigger)
 *   Y — UUID (assigned on first human edit; used as the DB catalog ID)
 *
 * Volunteers can freely edit all data columns (B–V). The system columns are
 * off-limits to humans — script-level writes bypass the protection automatically.
 *
 * Region sheet names are stored in _config!B2 as a comma-separated list,
 * managed by the app via the Sheets API. Static sheets (For RI, For FA, etc.)
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
 * - Run setupRegionSheets() once after initial setup, AND after adding any new
 *   region sheet. It is the single entry point — see USAGE below.
 *
 * SOURCE OF TRUTH: region names live in the app DB `regions` table (constrained
 * by the REGION_NAME_VALUES enum). The app mirrors that list into _config!B2 on
 * region create/delete (syncRegionSheetNames). Apps Script only READS B2 — it
 * never derives region names from tab titles, so a stray/typo'd tab can't become
 * a "region" and corrupt the sync.
 *
 * USAGE (manual, run from Apps Script editor only):
 * - setupRegionSheets()  — RECOMMENDED. Idempotent one-shot: reads the region
 *     list from _config!B2, warns on any tab/list mismatch, ensures the W/X/Y
 *     header labels, and (re)applies the A + W–Y protections. Run after creating
 *     a new region tab. PRECONDITION: the region already exists in the app and
 *     B2 is populated (the app writes B2 from the DB).
 * - setupSystemColProtection() / clearSystemColProtections() — lower-level
 *     protection-only helpers, kept for manual control.
 * - seedMissingUuids(getRegionSheetNames()) — backfill col-Y UUIDs for existing
 *     rows (also runs inside setupRegionSheets). Use standalone only if needed.
 *
 * STATIC_TABS below lists non-region tabs to ignore in the mismatch check.
 */

// Non-region tabs to ignore when cross-checking tabs against the B2 region list.
// UNKNOWN is intentionally NOT here — it is a synced region sheet with UUIDs.
// KEEP IN SYNC with NON_REGION_TABS in lib/constants.ts (this is the same list
// minus UNKNOWN). Apps Script can't import the TS const, so it's duplicated;
// when you add an auxiliary tab there, add it here too.
var STATIC_TABS = [
  "_config",
  "For RI",
  "For FA",
  "TEMPLATE",
  "HOME",
  "TNVR Statistics",
  "Coat Color and Kitten Breakdown",
  "SAMPLE",
];

/**
 * Consistency check (warns only, never acts). The region list is owned by the
 * app DB and mirrored to _config!B2 — this never derives names from tabs. It
 * just surfaces drift between the actual tabs and B2 so a typo'd or missing tab
 * is caught before it silently breaks sync.
 */
function warnTabMismatch(names) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var skip = {};
  STATIC_TABS.forEach(function (n) {
    skip[n] = true;
  });
  var tabs = ss
    .getSheets()
    .map(function (s) {
      return s.getName();
    })
    .filter(function (n) {
      return !skip[n];
    });

  var inList = {};
  names.forEach(function (n) {
    inList[n] = true;
  });
  var inTabs = {};
  tabs.forEach(function (n) {
    inTabs[n] = true;
  });

  tabs.forEach(function (t) {
    if (!inList[t]) {
      Logger.log(
        "WARN: tab '" +
          t +
          "' is not in _config!B2 — skipped. Fix the tab name to match a region, or add the region in the app first.",
      );
    }
  });
  names.forEach(function (n) {
    if (!inTabs[n]) {
      Logger.log("WARN: region '" + n + "' has no matching sheet tab yet.");
    }
  });
}

/**
 * Ensures the system-column header labels exist on each region sheet (row 2;
 * data starts row 3). Idempotent — overwrites with the same values each run.
 *   W2 = last_edited_at, X2 = edited_by, Y2 = uuid
 */
function ensureSystemHeaders(names) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  names.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    sheet.getRange("W2").setValue("last_edited_at");
    sheet.getRange("X2").setValue("edited_by");
    sheet.getRange("Y2").setValue("uuid");
  });
}

/**
 * DEPRECATED — use Admin → GSheet Config → Seed UUIDs (seedMissingUuidsAllRegions),
 * which runs server-side as the service account. This Apps Script twin is retained
 * only as a fallback. See setup guide §4.5 / §8.
 *
 * Bulk-assigns a UUID to col Y for every DATA row (row 3+) that has content but
 * no UUID yet. The onEdit trigger only seeds a row when a human edits it, so a
 * freshly onboarded sheet full of existing rows needs this one-time backfill —
 * reverse-sync skips UUID-less rows, so without it that data never imports.
 *
 * Idempotent: only fills blanks, never overwrites an existing UUID. A row counts
 * as "content" if any A–V cell is non-empty (so empty trailing rows are left
 * alone and don't become phantom cats). Batched read/write per sheet.
 */
function seedMissingUuids(names) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var DATA_START_ROW = 3;
  var DATA_COLS = 22; // A–V
  var UUID_COL = 25; // Y
  var seeded = 0;

  names.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < DATA_START_ROW) return;

    var n = lastRow - DATA_START_ROW + 1;
    var yRange = sheet.getRange(DATA_START_ROW, UUID_COL, n, 1);
    var yVals = yRange.getValues();
    var dataVals = sheet.getRange(DATA_START_ROW, 1, n, DATA_COLS).getValues();

    var changed = false;
    for (var i = 0; i < n; i++) {
      var hasContent = dataVals[i].some(function (c) {
        return c !== "" && c !== null;
      });
      if (hasContent && !String(yVals[i][0]).trim()) {
        yVals[i][0] = Utilities.getUuid();
        seeded++;
        changed = true;
      }
    }
    if (changed) yRange.setValues(yVals);
  });

  Logger.log("seedMissingUuids: assigned " + seeded + " UUID(s).");
}

/**
 * DEPRECATED — superseded by the admin UI (Admin → GSheet Config → Provision
 * Sheets + Seed UUIDs), which runs server-side as the service account. DO NOT use
 * this for routine setup: it creates OWNER-OWNED protections that lock the service
 * account out of its own col-A / col-Y writes (forward sync + backfillCatalogIds
 * fail with "trying to edit a protected cell"). The server path grants the service
 * account as editor and avoids this entirely. See the setup guide §4 / §7 / §8.
 *
 * Kept only so the one-time cutover cleanup (clearSystemColProtections, which only
 * the owner can run on owner-created protections) remains available.
 *
 * ONE-SHOT region setup (run from the Apps Script editor). Idempotent — safe to
 * re-run after adding a new region tab. Steps:
 *   1. Read the region list from _config!B2 (app-owned mirror of the DB)
 *   2. Warn on any tab/list mismatch (does not act on it)
 *   3. Ensure W/X/Y header labels
 *   4. Seed col-Y UUIDs for existing rows that lack one (so they can import)
 *   5. Clear then (re)apply the A + W–Y protections
 *
 * PRECONDITION: the region already exists in the app and B2 is populated. The
 * app writes B2 from the DB via Admin → GSheet Config → Provision Sheets
 * (syncRegionSheetNames). If B2 is empty, run that first, then re-run this.
 *
 * The onEdit trigger (Code.gs) is column-index based, so new tabs are already
 * covered for W/X/Y timestamping — no per-tab trigger setup needed.
 */
function setupRegionSheets() {
  var names = getRegionSheetNames();
  if (names.length === 0) {
    Logger.log(
      "_config!B2 is empty. Run the app's 'refresh region sheet config' admin action first (it writes the DB region list to B2), then re-run.",
    );
    return;
  }

  warnTabMismatch(names);
  ensureSystemHeaders(names);
  seedMissingUuids(names);

  // Clear first so re-runs don't stack duplicate protection objects.
  clearSystemColProtections();
  setupSystemColProtection();

  Logger.log("setupRegionSheets complete for: " + names.join(", "));
}

/**
 * Reads region sheet names from the _config sheet (cell B2).
 * The app writes region names here so protections apply only to region data sheets.
 * Returns an empty array if the sheet or cell doesn't exist.
 */
function getRegionSheetNames() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName("_config");
  if (!configSheet) {
    Logger.log("WARNING: _config sheet not found. No region names loaded.");
    return [];
  }
  var value = configSheet.getRange("B2").getValue();
  if (!value) return [];
  return String(value)
    .split(",")
    .map(function (n) {
      return n.trim();
    })
    .filter(Boolean);
}

// System columns that must never be manually edited
var CATALOG_COL_NOTATION = "A3:A"; // catalog number (A) — assigned by system
var SYSTEM_COLS_NOTATION = "W3:Y"; // edited_at (W), editor email (X), UUID (Y)

/**
 * STILL REQUIRED at cutover (not deprecated). Removes all A / W–Y protections on
 * region sheets. Must run from GAS as the spreadsheet OWNER because the service
 * account cannot delete protections it didn't create — so any OWNER-owned
 * protections left by the deprecated setupSystemColProtection() can only be
 * cleared here. Run this ONCE, then switch to the admin UI (Provision Sheets),
 * which re-applies protections owned by the service account and is self-serve
 * thereafter. See setup guide §4.4.
 */
function clearSystemColProtections() {
  var regionNames = getRegionSheetNames();
  if (regionNames.length === 0) {
    Logger.log("WARNING: No region names found in _config!B2. Clear aborted.");
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cleared = 0;

  regionNames.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;

    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(function (protection) {
      var col = protection.getRange().getColumn();
      // Column A (1) and columns W (23), X (24), Y (25)
      if (col === 1 || (col >= 23 && col <= 25)) {
        protection.remove();
        cleared++;
      }
    });
  });

  Logger.log("Cleared " + cleared + " system column protection(s).");
}

/**
 * DEPRECATED — use Admin → GSheet Config → Provision Sheets instead. This creates
 * protections OWNED BY THE OWNER and does NOT add the service account as an editor,
 * so the service account (a file-level Editor only) is locked out of cols A and
 * W–Y and its sync writes fail. The server-side setupSystemColProtections() grants
 * the service account as editor and is the canonical path. See setup guide §8.
 *
 * SETUP (run once): Permanently protect cols A and W–Y on all region sheets.
 *   A — catalog number, assigned by the system on each cron tick
 *   W–Y — edited_at, editor email, UUID (managed by trigger + service account)
 * No human should manually edit these. Script-level writes bypass protection.
 *
 * Region sheets are read from _config!B2.
 */
function setupSystemColProtection() {
  var regionNames = getRegionSheetNames();
  if (regionNames.length === 0) {
    Logger.log(
      "WARNING: No region names found in _config!B2. System column protection aborted.",
    );
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  regionNames.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      Logger.log("WARNING: Sheet '" + name + "' not found — skipping.");
      return;
    }

    var lastRow = Math.max(sheet.getLastRow(), 3);

    // Protect col A (catalog number)
    var colARange = sheet.getRange("A3:A" + lastRow);
    var colAProtection = colARange
      .protect()
      .setDescription("Catalog number (A) — assigned by system, do not edit manually");
    colAProtection.removeEditors(colAProtection.getEditors());
    if (colAProtection.canDomainEdit()) {
      colAProtection.setDomainEdit(false);
    }

    // Protect cols W–Y (system metadata)
    var sysRange = sheet.getRange("W3:Y" + lastRow);
    var sysProtection = sysRange
      .protect()
      .setDescription("System columns (edited_at, editor, UUID) — do not edit manually");
    sysProtection.removeEditors(sysProtection.getEditors());
    if (sysProtection.canDomainEdit()) {
      sysProtection.setDomainEdit(false);
    }
  });

  Logger.log("System columns (A, W–Y) protected on: " + regionNames.join(", "));
}

/**
 * True when a tab has no structure at all — every cell in A1:V2 is empty.
 *
 * This is what makes the orphan check race-proof. A tab cloned from TEMPLATE
 * always carries header row 2, so it can never be flagged no matter when this
 * trigger fires relative to the app writing _config!B2. A tab a steward creates
 * with the "+" button is genuinely blank and is still caught. The test is a
 * fact about the tab rather than a race against the app.
 */
function isStructurallyBlank(sheet) {
  var values = sheet.getRange(1, 1, 2, 22).getValues(); // A1:V2
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      if (String(values[r][c]).trim() !== "") return false;
    }
  }
  return true;
}

/**
 * Installable onChange trigger — flags region tabs created BY HAND (outside the
 * app). Sync only ever touches tabs whose name matches a DB region (mirrored to
 * _config!B2); a tab made directly in the spreadsheet is invisible to sync, so
 * anything typed into it is silently lost. This catches that at creation time.
 *
 * Fires on every structural change; acts only on INSERT_GRID (a new tab). Any
 * present tab whose name is neither a STATIC_TAB nor in _config!B2 is treated as
 * a hand-made orphan: a red warning banner is dropped into its first row and a
 * toast is shown to whoever is currently viewing.
 *
 * OPT-OUT: a tab whose name starts with "_" is treated as an intentional
 * non-region helper tab and is never flagged (same marker as _config). This is
 * how a non-technical steward keeps a legit notes/stats tab — the banner copy
 * tells them to rename it with a leading underscore.
 *
 * App-created region tabs are NOT flagged: they are clones of the TEMPLATE tab
 * and always carry header row 2, so isStructurallyBlank returns false for them
 * regardless of when this trigger fires relative to _config!B2 propagation.
 *
 * HOW TO DEPLOY (one-time, like the onEdit trigger):
 *   Triggers (clock icon) -> + Add Trigger
 *     - Function: onSheetChange
 *     - Event source: From spreadsheet
 *     - Event type: On change
 *     - Failure notification: Notify daily
 */
function onSheetChange(e) {
  if (!e || e.changeType !== "INSERT_GRID") return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Allowlist = static tabs + DB regions (from _config!B2, app-owned mirror).
  var allowed = {};
  STATIC_TABS.forEach(function (n) {
    allowed[n] = true;
  });
  getRegionSheetNames().forEach(function (n) {
    allowed[n] = true;
  });

  var orphans = ss.getSheets().filter(function (s) {
    var name = s.getName();
    // "_"-prefixed tabs are intentional non-region helper tabs (same opt-out
    // marker as _config). Stewards rename a helper tab to start with "_" to
    // dismiss the orphan warning — see warnOrphanTab banner copy.
    if (name.charAt(0) === "_") return false;
    if (allowed[name]) return false;
    // Only a genuinely blank tab is a hand-made orphan. Anything carrying
    // header structure is a region tab (or a clone of one) mid-provisioning.
    return isStructurallyBlank(s);
  });
  if (orphans.length === 0) return;

  orphans.forEach(function (sheet) {
    try {
      warnOrphanTab(sheet);
    } catch (err) {
      // One bad tab must not abort the rest (and the toast below).
      Logger.log("warnOrphanTab failed for " + sheet.getName() + ": " + err);
    }
  });

  var names = orphans
    .map(function (s) {
      return '"' + s.getName() + '"';
    })
    .join(", ");
  try {
    ss.toast(
      "Tab " +
        names +
        " was not created through the app and will NOT sync. Delete it and add " +
        "the region via the app (Admin > Edit Regions) — or, if it's an intentional " +
        'helper tab, rename it to start with "_".',
      "⚠️ This tab won't sync",
      30,
    );
  } catch (err) {
    // toast needs a UI context it may not have here — the banner already covers it.
  }
}

/**
 * Drops a persistent red warning banner into row 1 of an orphan tab so the
 * caution survives regardless of who opens the sheet later. Idempotent — skips
 * a tab already flagged (so repeated onChange fires don't stack banners). A
 * freshly inserted tab is blank, so writing A1 clobbers nothing.
 */
function warnOrphanTab(sheet) {
  var a1 = sheet.getRange("A1");
  if (String(a1.getValue()).indexOf("will NOT sync") !== -1) return;

  // Deliberately NOT merged across A1:L1. A merge here destroys the title row
  // of a region sheet if this ever fires on one, and createRegionSheetTab only
  // clears A3:Z so the damage would be permanent.
  a1.setValue(
    "⚠️ This tab was created by hand and will NOT sync — anything entered here is lost. " +
      "To add a REGION, use the app (Admin > Edit Regions), then delete this tab. " +
      'If you meant a HELPER tab (notes/stats, not a region), rename it to start with an ' +
      'underscore — e.g. "_Notes" — and this warning will stop.',
  );
  a1.setBackground("#cc0000");
  a1.setFontColor("#ffffff");
  a1.setFontWeight("bold");
  a1.setWrap(true);
}
