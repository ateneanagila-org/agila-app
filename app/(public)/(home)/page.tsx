import { CatalogScreen } from "@/components/app-pages/catalog/catalog-screen";
import { getLinks } from "@/lib/services/system.service";

export default async function HomePage() {
  const links = await getLinks();
  return <CatalogScreen adoptFosterUrl={links.adoptFoster} />;
}
