import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { syncAllPendingRegions } from "@/app/actions/google-sheets";

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
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[Cron Sync] Failed:", message);
    }
  });

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
