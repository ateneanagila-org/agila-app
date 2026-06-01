import "dotenv/config";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== Cat-by-session-link multiplicity (should all be 1) ===");
  const multiLink = await db.execute(sql`
    SELECT sc_count, COUNT(*)::int AS cats
    FROM (
      SELECT c.id, COUNT(sc.id)::int AS sc_count
      FROM cats c
      LEFT JOIN session_cats sc ON sc.cat_id = c.id
      LEFT JOIN sessions s ON s.id = sc.session_id AND s.is_system = TRUE
      GROUP BY c.id
    ) t
    GROUP BY sc_count ORDER BY sc_count
  `);
  console.table(multiLink);

  console.log("\n=== Cats with multiple system-session links (the duplicates) ===");
  const dupes = await db.execute(sql`
    SELECT c.id, c.name, c.cat_status::text, c.last_updated_at,
           array_agg(r.name) AS regions_linked
    FROM cats c
    JOIN session_cats sc ON sc.cat_id = c.id
    JOIN sessions s ON s.id = sc.session_id AND s.is_system = TRUE
    JOIN regions r ON r.id = s.region_id
    GROUP BY c.id, c.name, c.cat_status, c.last_updated_at
    HAVING COUNT(*) > 1
    LIMIT 20
  `);
  console.table(dupes);

  console.log("\n=== Audit log: REVERSE runs that imported fewer rows than the sheet had ===");
  const audit = await db.execute(sql`
    SELECT r.name, a.tasks_processed, a.tasks_failed, a.error_message
    FROM sync_audit_log a
    LEFT JOIN regions r ON r.id = a.region_id
    WHERE a.started_at > NOW() - INTERVAL '2 hours' AND a.direction = 'REVERSE'
    ORDER BY a.started_at DESC
  `);
  console.table(audit);

  console.log("\n=== Header recount (should reconcile per-region sum) ===");
  const header = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_cats,
      COUNT(*) FILTER (WHERE cat_status IS NULL)::int AS active,
      COUNT(*) FILTER (WHERE cat_status = 'MIA')::int AS mia,
      COUNT(*) FILTER (WHERE cat_status = 'Deceased')::int AS deceased,
      COUNT(*) FILTER (WHERE cat_status = 'Adopted')::int AS adopted,
      COUNT(*) FILTER (WHERE cat_status = 'Fostered')::int AS fostered
    FROM cats
  `);
  console.table(header);

  console.log("\n=== Sync queue ===");
  const queue = await db.execute(sql`
    SELECT action::text, status::text, COUNT(*)::int AS n
    FROM gsheet_sync_queue GROUP BY 1,2 ORDER BY 1,2
  `);
  console.table(queue);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
