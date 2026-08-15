import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * This endpoint is unauthenticated by necessity — the Cloudflare Worker polls it
 * before each cron tick. Two consequences are handled here:
 *
 * 1. It must not consume a pooled connection per request. The pool's max is 12
 *    (see lib/db/index.ts), so an uncached check is a trivial way for anyone to
 *    exhaust it. The result is cached briefly; the worker polls once per tick
 *    and never notices.
 * 2. It must not return the underlying error. Postgres connection failures carry
 *    the host, port, and database name. The message is logged server-side and
 *    the caller gets a bare status — the worker branches on the status code.
 */
const CACHE_TTL_MS = 10_000;

let cached: { at: number; healthy: boolean } | null = null;

export async function GET() {
  const now = Date.now();

  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.healthy
      ? NextResponse.json({ status: "healthy", cached: true })
      : NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }

  try {
    await db.execute(sql`SELECT 1`);
    cached = { at: now, healthy: true };
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    cached = { at: now, healthy: false };
    console.error(
      "[Health] Database check failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
