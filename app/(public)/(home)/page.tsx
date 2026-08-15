import type { Metadata } from "next";
import { CatalogScreen } from "@/components/app-pages/catalog/catalog-screen";
import { getLinks } from "@/lib/services/system.service";

export const metadata: Metadata = {
  title: "Adopt a Cat in Quezon City",
  description:
    "Meet campus cats available for adoption and fostering, based at Ateneo de Manila University in Quezon City and open to adopters across Metro Manila.",
  openGraph: {
    type: "website",
    title: "Adopt a Cat in Quezon City",
    description:
      "Meet campus cats available for adoption and fostering, based at Ateneo de Manila University in Quezon City and open to adopters across Metro Manila.",
  },
};

export default async function HomePage() {
  const links = await getLinks();
  return <CatalogScreen adoptFosterUrl={links.adoptFoster} />;
}
