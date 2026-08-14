import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { syncAllPendingRegions } from "@/lib/services/sync-cron.service";
import {
  setSyncFrozen,
  isSyncRetired,
  shouldRunPhotoGc,
  markPhotoGcRun,
} from "@/lib/services/system.service";
import { sendSyncAlert } from "@/lib/services/discord.service";
import { reconcileCatPhotos } from "@/lib/services/photo-import.service";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Retired systems do no work at all. This sits after the auth check so an
  // unauthenticated caller still gets 401 rather than learning our state, and
  // before after() so a retired tick costs no queries — it may keep firing for
  // years if nobody disables the Cloudflare trigger.
  if (await isSyncRetired()) {
    return NextResponse.json({ ok: true, retired: true });
  }

  after(async () => {
    try {
      await syncAllPendingRegions();
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown sync error";
      console.error("[Cron Sync] Failed — auto-freezing:", reason);
      try {
        await setSyncFrozen(true, reason);
      } catch (freezeError) {
        console.error("[Cron Sync] Failed to write freeze flag:", freezeError);
      }
      await sendSyncAlert(
        `Sync auto-frozen. Reason: ${reason}. Unfreeze from the admin panel after resolving.`,
      );
    }

    // Weekly orphan sweep. Deliberately OUTSIDE syncAllPendingRegions: that
    // function has two early returns (idle tick, and no summary regen needed),
    // so a sweep appended to its end would be skipped on most ticks and would
    // effectively never run.
    //
    // Its own try/catch, separate from the sync one above: that handler
    // auto-freezes sync on error, and a storage-cleanup failure must not do
    // that — it would raise a false alarm on the wrong subsystem.
    try {
      if (await shouldRunPhotoGc()) {
        const result = await reconcileCatPhotos();
        await markPhotoGcRun();
        console.log(
          `[PhotoGC] Swept ${result.scanned} object(s), removed ${result.removed}.`,
        );
      }
    } catch (error) {
      console.error(
        "[PhotoGC] Sweep failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  });

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
