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
  // The site answers on both the apex and www (the apex 308s to www), so name
  // the canonical host explicitly rather than leaving Google to infer it from
  // redirects. Resolved against metadataBase (NEXT_PUBLIC_SITE_URL).
  alternates: { canonical: "/" },
  description:
    "Meet campus cats available for adoption and fostering, based at Ateneo de Manila University in Quezon City and open to adopters across Metro Manila.",
};

export default async function HomePage() {
  const links = await getLinks();
  return <CatalogScreen adoptFosterUrl={links.adoptFoster} />;
}
