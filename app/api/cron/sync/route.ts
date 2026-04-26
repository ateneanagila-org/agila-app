import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { syncAllPendingRegions } from "@/app/actions/google-sheets";
import { setSyncFrozen } from "@/lib/services/system.service";
import { sendSyncAlert } from "@/lib/services/discord.service";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
