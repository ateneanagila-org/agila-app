import type { Metadata } from "next";
import { SessionsApprovalCrossRefScreen } from "@/components/app-pages/sessions/sessions-approval-crossref-screen";
import { findCats, findCatHealthRecords } from "@/lib/repo/cats.repo";
import { findRegions } from "@/lib/repo/regions.repo";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = { title: "Sessions — Cross-Reference" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  searchParams: Promise<{ catId?: string }>;
};

/**
 * Seeds the screen from the server — see the validation page for why. The merge
 * target list is the expensive one (the whole Original catalog, with the
 * per-row region subquery), so fetching it alongside the focused cat here means
 * the hop from validation carries it instead of paying for it after mount.
 *
 * Seeding the focused cat's health record too lets the merge dialog open with
 * one lookup instead of two.
 */
export default async function SessionsApprovalCrossRefPage({
  searchParams,
}: PageProps) {
  const { catId } = await searchParams;
  // The id comes straight off the URL; handing a non-UUID to Postgres throws
  // rather than returning no rows.
  const valid = typeof catId === "string" && UUID_RE.test(catId);

  const [catRows, healthRecords, mergeTargets, regions] = await Promise.all([
    valid
      ? loadData(
          "Approval cross-ref cat initial load",
          () => findCats({ id: catId }),
          [],
        )
      : Promise.resolve([]),
    valid
      ? loadData(
          "Approval cross-ref health record initial load",
          () => findCatHealthRecords({ cat_id: catId }),
          [],
        )
      : Promise.resolve([]),
    loadData(
      "Approval cross-ref merge targets initial load",
      () => findCats({ entry_status: "Original" }),
      [],
    ),
    loadData("Approval cross-ref regions initial load", () => findRegions(), []),
  ]);

  // key: the screen seeds its state from these props at mount, so a different
  // cat has to be a different instance rather than a re-render still holding
  // the previous cat's selections.
  return (
    <SessionsApprovalCrossRefScreen
      key={catId ?? "none"}
      initialCat={catRows[0] ?? null}
      initialHealthRecord={healthRecords[0] ?? null}
      initialMergeTargets={mergeTargets}
      initialRegions={regions}
    />
  );
}
