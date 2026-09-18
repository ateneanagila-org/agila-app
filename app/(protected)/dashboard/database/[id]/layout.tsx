import type { ReactNode } from "react";
import { CatDetailProvider } from "@/contexts/cat-detail-context";
import { CatDetailHeader } from "@/components/app-pages/database/cat-detail-header";
import { PageContent } from "@/components/app-pages/shared/page-frame";
import { findCats, findCatHealthRecords } from "@/lib/repo/cats.repo";
import { findInterventions } from "@/lib/repo/interventions.repo";
import { loadData } from "@/lib/safe-initial-data";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

/**
 * Resolves the focused cat once, for all three tabs. Because this is a layout it
 * is shared by General/Medical/Interventions and is not re-executed when you
 * switch between them, so the cat is fetched once per cat rather than once per
 * tab — the same property the client provider used to give, now without the
 * round trip that followed mount.
 *
 * A null seed is not an error path: the provider falls back to fetching, which
 * is what recovers a transient DB failure that loadData swallowed.
 */
export default async function CatDetailLayout({
  children,
  params,
}: LayoutProps) {
  const { id } = await params;
  // The id comes straight off the URL; handing a non-UUID to Postgres throws
  // rather than returning no rows.
  const valid = UUID_RE.test(id);

  const seed = valid
    ? await loadData(
        "Cat detail initial load",
        async () => {
          const [catRows, healthRecords, interventions] = await Promise.all([
            findCats({ id }),
            findCatHealthRecords({ cat_id: id }),
            findInterventions({ cat_id: id }),
          ]);
          return {
            cat: catRows[0] ?? null,
            healthRecord: healthRecords[0] ?? null,
            interventions,
          };
        },
        null,
      )
    : null;

  // key: the provider seeds its state at mount, so a different cat has to be a
  // different instance rather than one holding the previous cat's data.
  //
  // The identity card and tabs render here rather than inside each tab screen so
  // that switching tabs cannot tear them down — a loading boundary only replaces
  // what is below it, and below it is now just the tab body.
  return (
    <CatDetailProvider key={id} catId={id} initial={seed}>
      <PageContent>
        <CatDetailHeader />
        {children}
      </PageContent>
    </CatDetailProvider>
  );
}
