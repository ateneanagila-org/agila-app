import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { syncAllPendingRegions } from "@/lib/services/sync-cron.service";
import { setSyncFrozen, isSyncRetired } from "@/lib/services/system.service";
import { sendSyncAlert } from "@/lib/services/discord.service";

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
  });

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
