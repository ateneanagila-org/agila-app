import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cats,
  catHealthRecords,
  syncAuditLog,
  gsheetSyncQueue,
} from "@/lib/db/schema";
import {
  readSheetState,
  SheetRow,
  clearSheetEditTimestamps,
} from "./helper.service";
import { isSyncFrozen } from "./system.service";
import {
  sheetRowSchema,
  parseSheetRow,
  parseUnknownSheetRow,
  SheetRowParsed,
} from "@/lib/validation/reverse-sync";
import { parseCatalogId } from "@/lib/services/catalog.service";
import { linkCatToSystemSession } from "@/lib/services/system-session.service";

/**
 * 5-second safety buffer (in milliseconds).
 * If DB and GSheet timestamps are within this window, DB wins.
 */
const CONFLICT_BUFFER_MS = 5_000;

interface ReverseSyncResult {
  imported: number;
  skipped: number;
  errors: Array<{ entityId: string; error: string }>;
}

/**
 * Core reverse sync logic — no freeze check.
 * Used by both the normal cron path and the recovery path.
 */
async function reverseSyncRegionInternal(
  regionId: string,
): Promise<ReverseSyncResult> {
  const result: ReverseSyncResult = { imported: 0, skipped: 0, errors: [] };
  const startedAt = new Date();
  const importedIds: string[] = [];

  // Fetch region for UNKNOWN branching
  const region = await db.query.regions.findFirst({
    where: (r, { eq }) => eq(r.id, regionId),
  });

  let sheetRows: SheetRow[];
  try {
    sheetRows = await readSheetState(regionId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to read sheet";
    await db.insert(syncAuditLog).values({
      regionId,
      direction: "REVERSE",
      tasksProcessed: 0,
      tasksFailed: 0,
      errorMessage: msg,
      startedAt,
      completedAt: new Date(),
    });
    throw error;
  }

  for (const sheetRow of sheetRows) {
    if (!sheetRow.lastEditedAt) {
      result.skipped++;
      continue;
    }

    const sheetEditedAt = new Date(sheetRow.lastEditedAt);
    if (isNaN(sheetEditedAt.getTime())) {
      result.errors.push({
        entityId: sheetRow.entityId,
        error: `Invalid timestamp: ${sheetRow.lastEditedAt}`,
      });
      continue;
    }

    const dbCat = await db.query.cats.findFirst({
      where: (cols, { eq }) => eq(cols.id, sheetRow.entityId),
      with: { catHealthRecords: true },
    });

    if (!dbCat) {
      // CREATE: new cat added manually via sheet (Apps Script generated UUID in col Y)
      try {
        const isUnknown = region?.name === "UNKNOWN";
        const rawParsed = isUnknown
          ? parseUnknownSheetRow(sheetRow.raw)
          : parseSheetRow(sheetRow.raw);

        if (!rawParsed) {
          result.skipped++;
          continue;
        }

        const validation = sheetRowSchema.safeParse(rawParsed);
        if (!validation.success) {
          result.errors.push({
            entityId: sheetRow.entityId,
            error: `Create validation failed: ${validation.error.issues.map((i) => i.message).join(", ")}`,
          });
          continue;
        }

        const catalogIdRaw = String(sheetRow.raw[0] ?? "").trim();
        const parsed = parseCatalogId(catalogIdRaw);
        const catalog_id = parsed !== null ? String(parsed) : null;

        await db.transaction(async (tx) => {
          const { id: _id, condition, neuter_date, vaccination_date, paws_id, ...catFields } = validation.data;
          const [newCat] = await tx
            .insert(cats)
            .values({
              id: sheetRow.entityId,
              catalog_id,
              paws_id: paws_id ?? null,
              ...catFields,
            })
            .returning();

          await tx.insert(catHealthRecords).values({
            cat_id: newCat.id,
            condition,
            neuter_date: neuter_date ? new Date(neuter_date) : null,
            vaccination_date: vaccination_date ? new Date(vaccination_date) : null,
          });

          await linkCatToSystemSession(newCat.id, regionId, tx);
        });

        result.imported++;
        importedIds.push(sheetRow.entityId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Create failed";
        result.errors.push({ entityId: sheetRow.entityId, error: msg });
      }
      continue;
    }

    const dbUpdatedAt = dbCat.last_updated_at
      ? new Date(dbCat.last_updated_at)
      : new Date(0);

    if (sheetEditedAt.getTime() <= dbUpdatedAt.getTime() + CONFLICT_BUFFER_MS) {
      result.skipped++;
      continue;
    }

    const isUnknown = region?.name === "UNKNOWN";
    const rawParsed = isUnknown
      ? parseUnknownSheetRow(sheetRow.raw)
      : parseSheetRow(sheetRow.raw);
    if (!rawParsed) {
      result.errors.push({
        entityId: sheetRow.entityId,
        error: "Failed to parse sheet row",
      });
      continue;
    }

    const validation = sheetRowSchema.safeParse(rawParsed);
    if (!validation.success) {
      result.errors.push({
        entityId: sheetRow.entityId,
        error: `Validation failed: ${validation.error.issues.map((i) => i.message).join(", ")}`,
      });
      continue;
    }

    try {
      await importSheetRowToDB(validation.data);
      result.imported++;
      importedIds.push(sheetRow.entityId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Import failed";
      result.errors.push({ entityId: sheetRow.entityId, error: msg });
    }
  }

  // Clear GSheet timestamps for successfully imported rows
  // so they won't be re-imported on the next cycle
  try {
    await clearSheetEditTimestamps(regionId, importedIds);
  } catch (error) {
    console.error(
      `[ReverseSync] Failed to clear timestamps for region ${regionId}:`,
      error instanceof Error ? error.message : error,
    );
    // Non-fatal — worst case is re-importing the same edit next cycle (idempotent)
  }

  await db.insert(syncAuditLog).values({
    regionId,
    direction: "REVERSE",
    tasksProcessed: result.imported,
    tasksFailed: result.errors.length,
    errorMessage:
      result.errors.length > 0
        ? JSON.stringify(result.errors.slice(0, 10))
        : null,
    startedAt,
    completedAt: new Date(),
  });

  return result;
}

/**
 * Public reverse sync for a single region — checks freeze flag first.
 * Called by the normal cron cycle.
 */
export async function reverseSyncRegion(
  regionId: string,
): Promise<ReverseSyncResult> {
  const frozen = await isSyncFrozen();
  if (frozen) {
    console.log(`[ReverseSync] Frozen — skipping region ${regionId}`);
    return { imported: 0, skipped: 0, errors: [] };
  }
  return reverseSyncRegionInternal(regionId);
}

/**
 * Full reverse sync for ALL regions. Used during unfreeze recovery.
 * Bypasses the freeze check since it's called explicitly during recovery.
 *
 * Does NOT discard PENDING forward sync tasks — those are still valid
 * for cats that managers didn't touch during the freeze.
 * importSheetRowToDB's conflict resolution cancels PENDING tasks only
 * for cats where a newer GSheet edit was imported.
 */
export async function fullReverseSync(): Promise<{
  regions: number;
  totalImported: number;
  totalErrors: number;
}> {
  const allRegions = await db.query.regions.findMany();
  let totalImported = 0;
  let totalErrors = 0;

  for (const region of allRegions) {
    try {
      const result = await reverseSyncRegionInternal(region.id);
      totalImported += result.imported;
      totalErrors += result.errors.length;
    } catch (error) {
      console.error(
        `[FullReverseSync] Region ${region.id} failed:`,
        error instanceof Error ? error.message : error,
      );
      totalErrors++;
    }
  }

  return { regions: allRegions.length, totalImported, totalErrors };
}

/**
 * Writes a validated sheet row back to the DB.
 * Updates cats and cat_health_records tables.
 * Cancels any pending forward sync tasks for this cat (GSheet wins — Task 15).
 */
async function importSheetRowToDB(data: SheetRowParsed): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(cats)
      .set({
        name: data.name,
        color: data.color,
        age: data.age,
        sex: data.sex,
        sociability: data.sociability,
        cat_status: data.cat_status,
        spot_last_seen: data.spot_last_seen,
        caretaker: data.caretaker,
        notes: data.notes,
        is_adoptable: data.is_adoptable,
        photo_url: data.photo_url,
        ...(data.paws_id !== undefined ? { paws_id: data.paws_id } : {}),
        last_updated_at: new Date(),
      })
      .where(eq(cats.id, data.id));

    const healthUpdate: Record<string, unknown> = {
      condition: data.condition,
      last_updated_at: new Date(),
    };

    if (data.neuter_date) {
      const parsed = new Date(data.neuter_date);
      if (!isNaN(parsed.getTime())) healthUpdate.neuter_date = parsed;
    } else {
      healthUpdate.neuter_date = null;
    }

    if (data.vaccination_date) {
      const parsed = new Date(data.vaccination_date);
      if (!isNaN(parsed.getTime())) healthUpdate.vaccination_date = parsed;
    } else {
      healthUpdate.vaccination_date = null;
    }

    await tx
      .update(catHealthRecords)
      .set(healthUpdate)
      .where(eq(catHealthRecords.cat_id, data.id));

    // Cancel pending forward sync tasks for this cat — GSheet edit wins.
    // Marked COMPLETED (not FAILED) since this is intentional cancellation.
    await tx
      .update(gsheetSyncQueue)
      .set({ status: "COMPLETED", lastError: "Superseded by reverse sync" })
      .where(
        and(
          eq(gsheetSyncQueue.entityId, data.id),
          eq(gsheetSyncQueue.status, "PENDING"),
        ),
      );
  });
}
