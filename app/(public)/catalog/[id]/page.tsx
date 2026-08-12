import { CatalogDetailScreen } from "@/components/app-pages/catalog/catalog-detail-screen";
import { getLinks } from "@/lib/services/system.service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CatalogDetailPage({ params }: PageProps) {
  const [{ id }, links] = await Promise.all([params, getLinks()]);
  return <CatalogDetailScreen catId={id} adoptFosterUrl={links.adoptFoster} />;
}
