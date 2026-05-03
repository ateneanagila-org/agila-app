import "dotenv/config";
import { db } from "@/lib/db";

async function main() {
  // Count cats per region via session_cats -> sessions -> regions
  const regions = await db.query.regions.findMany();
  const sessionCats = await db.query.sessionCats.findMany({
    with: { session: true },
  });

  // Latest region per cat
  const latestRegion = new Map<string, string>();
  for (const sc of sessionCats) {
    if (!latestRegion.has(sc.cat_id)) {
      latestRegion.set(sc.cat_id, sc.session?.region_id ?? "");
    }
  }

  const regionCountMap = new Map<string, number>();
  for (const [, rid] of latestRegion) {
    regionCountMap.set(rid, (regionCountMap.get(rid) ?? 0) + 1);
  }

  console.log("DB cat counts per region:");
  const sorted = regions.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of sorted) {
    const count = regionCountMap.get(r.id) ?? 0;
    console.log(`  ${r.name}: ${count}`);
  }

  const total = await db.query.cats.findMany();
  console.log("\nTotal cats in DB:", total.length);

  // Cats with no session linkage
  const linkedIds = new Set(latestRegion.keys());
  const unlinked = total.filter((c) => !linkedIds.has(c.id));
  console.log("Cats with no region link:", unlinked.length);
  if (unlinked.length > 0) {
    for (const c of unlinked.slice(0, 10)) {
      console.log(`  id=${c.id} name=${c.name} catalog_id=${c.catalog_id}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
