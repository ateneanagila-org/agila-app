import "dotenv/config";
import { db } from "@/lib/db";
import { syncAuditLog, cats } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  // Raw count to bypass any query API issues
  const [auditCount] = await db.select({ count: sql<number>`count(*)` }).from(syncAuditLog);
  console.log("sync_audit_log row count (raw):", auditCount.count);

  const [catCount] = await db.select({ count: sql<number>`count(*)` }).from(cats);
  console.log("cats row count:", catCount.count);

  // Try findMany directly
  const logs = await db.query.syncAuditLog.findMany({ limit: 5 });
  console.log("syncAuditLog.findMany result count:", logs.length);
  if (logs.length > 0) {
    for (const l of logs) {
      console.log(" -", l.direction, "region:", l.regionId, "processed:", l.tasksProcessed, "failed:", l.tasksFailed, "err:", l.errorMessage?.slice(0, 80));
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
