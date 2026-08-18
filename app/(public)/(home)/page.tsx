import type { Metadata } from "next";
import { CatalogScreen } from "@/components/app-pages/catalog/catalog-screen";
import { getLinks } from "@/lib/services/system.service";

// Only the page title and meta description. openGraph/twitter are deliberately
// NOT declared: this page is the site root, so the share card it wants is the
// one in app/layout.tsx — and re-declaring `openGraph` here would replace that
// block and drop the file-based opengraph-image with it.
//
// "from Ateneo" rather than "in Quezon City": the location phrasing competes
// with every Metro Manila shelter and cannot win, while Ateneo is the term
// AGILA ranks first for by default. The geography still lives in the
// description below, which is where location intent is read anyway.
export const metadata: Metadata = {
  title: "Adopt a Cat From Ateneo",
  description:
    "Meet campus cats available for adoption and fostering, based at Ateneo de Manila University in Quezon City and open to adopters across Metro Manila.",
};

export default async function HomePage() {
  const links = await getLinks();
  return <CatalogScreen adoptFosterUrl={links.adoptFoster} />;
}
