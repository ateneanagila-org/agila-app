import type { Metadata } from "next";
import { SessionsApprovalValidationScreen } from "@/components/app-pages/sessions/sessions-approval-validation-screen";
import { findCats, findCatHealthRecords } from "@/lib/repo/cats.repo";
import { findRegions } from "@/lib/repo/regions.repo";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = { title: "Sessions — Validate Entry" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  searchParams: Promise<{ catId?: string }>;
};

/**
 * Seeds the screen from the server. Previously this was a pass-through and the
 * client fetched on mount — three server actions that Next runs one at a time
 * through its action queue, each re-validating auth before it could query. Doing
 * it here folds that work into the navigation request that was already happening.
 *
 * A null seed is not an error path: the screen still falls back to its own fetch,
 * which is what recovers a transient DB failure that loadData swallowed.
 */
export default async function SessionsApprovalValidationPage({
  searchParams,
}: PageProps) {
  const { catId } = await searchParams;
  // The id comes straight off the URL; handing a non-UUID to Postgres throws
  // rather than returning no rows.
  const valid = typeof catId === "string" && UUID_RE.test(catId);

  const [catRows, healthRecords, regions] = await Promise.all([
    valid
      ? loadData(
          "Approval validation cat initial load",
          () => findCats({ id: catId }),
          [],
        )
      : Promise.resolve([]),
    valid
      ? loadData(
          "Approval validation health record initial load",
          () => findCatHealthRecords({ cat_id: catId }),
          [],
        )
      : Promise.resolve([]),
    loadData("Approval validation regions initial load", () => findRegions(), []),
  ]);

  // key: the screen seeds its state from these props at mount, so a different
  // cat has to be a different instance rather than a re-render still holding
  // the previous cat's form values.
  return (
    <SessionsApprovalValidationScreen
      key={catId ?? "none"}
      initialCat={catRows[0] ?? null}
      initialHealthRecord={healthRecords[0] ?? null}
      initialRegions={regions}
    />
  );
}
