import { CatalogDetailScreen } from "@/components/app-pages/catalog/catalog-detail-screen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CatalogDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <CatalogDetailScreen catId={id} />;
}
