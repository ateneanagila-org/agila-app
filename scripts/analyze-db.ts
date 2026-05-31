import "dotenv/config";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  // Per-region via session linkage (the default region source) with override applied
  // Rule: effective_region = COALESCE(cats.region_id, system_session.region_id)
  console.log("=== PER-REGION via session linkage (active cats only) ===");
  const perRegion = await db.execute(sql`
    WITH effective AS (
      SELECT c.id AS cat_id,
             c.cat_status,
             COALESCE(c.region_id, s.region_id) AS region_id
      FROM cats c
      LEFT JOIN session_cats sc ON sc.cat_id = c.id
      LEFT JOIN sessions s ON s.id = sc.session_id AND s.is_system = TRUE
    )
    SELECT r.name AS region,
           COUNT(*) FILTER (WHERE e.cat_status IS NULL)::int AS active,
           COUNT(*) FILTER (WHERE e.cat_status = 'MIA')::int AS mia,
           COUNT(*) FILTER (WHERE e.cat_status = 'Deceased')::int AS deceased,
           COUNT(*) FILTER (WHERE e.cat_status = 'Adopted')::int AS adopted,
           COUNT(*) FILTER (WHERE e.cat_status = 'Fostered')::int AS fostered,
           COUNT(*)::int AS total
    FROM regions r
    LEFT JOIN effective e ON e.region_id = r.id
    GROUP BY r.name
    ORDER BY total DESC, r.name
  `);
  console.table(perRegion.rows ?? perRegion);

  console.log("\n=== Cats with NO session link (would be invisible) ===");
  const orphans = await db.execute(sql`
    SELECT COUNT(*)::int AS orphan_cats
    FROM cats c
    WHERE NOT EXISTS (
      SELECT 1 FROM session_cats sc
      JOIN sessions s ON s.id = sc.session_id AND s.is_system = TRUE
      WHERE sc.cat_id = c.id
    )
    AND c.region_id IS NULL
  `);
  console.table(orphans.rows ?? orphans);

  console.log("\n=== Active cat header stats (status NULL) ===");
  const headerStats = await db.execute(sql`
    SELECT
      COUNT(*)::int AS active,
      COUNT(*) FILTER (WHERE hr.neuter_date IS NOT NULL)::int AS neutered,
      COUNT(*) FILTER (WHERE hr.neuter_date IS NULL)::int AS unneutered,
      COUNT(*) FILTER (WHERE c.sociability = 'Domesticated')::int AS domesticated,
      COUNT(*) FILTER (WHERE c.sociability = 'Tame')::int AS tame,
      COUNT(*) FILTER (WHERE c.sociability = 'Feral')::int AS feral,
      COUNT(*) FILTER (WHERE hr.condition IN ('Sick','Sick and Injured'))::int AS sick,
      COUNT(*) FILTER (WHERE hr.condition IN ('Injured','Sick and Injured'))::int AS injured,
      COUNT(*) FILTER (WHERE c.is_adoptable = TRUE)::int AS adoptable,
      COUNT(*) FILTER (WHERE c.name IS NULL OR c.name = '')::int AS unnamed
    FROM cats c
    LEFT JOIN cat_health_records hr ON hr.cat_id = c.id
    WHERE c.cat_status IS NULL
  `);
  console.table(headerStats.rows ?? headerStats);

  console.log("\n=== Audit per region (this run) ===");
  const audit = await db.execute(sql`
    SELECT r.name, a.tasks_processed, a.tasks_failed, a.error_message
    FROM sync_audit_log a
    LEFT JOIN regions r ON r.id = a.region_id
    WHERE a.started_at > NOW() - INTERVAL '1 day' AND a.direction = 'REVERSE'
    ORDER BY a.tasks_processed DESC
  `);
  console.table(audit.rows ?? audit);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
