import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogDetailScreen } from "@/components/app-pages/catalog/catalog-detail-screen";
import { getLinks } from "@/lib/services/system.service";
import * as repo from "@/lib/repo/cats.repo";

type PageProps = {
  params: Promise<{ id: string }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * cache() dedupes this between generateMetadata and the page body, so the
 * request costs one query rather than two. The UUID guard matters: the id comes
 * straight from the URL, and handing a non-UUID to Postgres throws rather than
 * returning no rows.
 */
const getCat = cache(async (id: string) => {
  if (!UUID_RE.test(id)) return null;
  try {
    const rows = await repo.findAdoptableCats({ id, is_adoptable: true });
    return rows[0] ?? null;
  } catch (error) {
    console.error("[Catalog] Failed to load cat:", error);
    return null;
  }
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const cat = await getCat(id);
  if (!cat) return { title: "Cat not found" };

  const name = cat.name?.trim() || "Unnamed cat";
  const traits = [cat.age, cat.color, cat.sex].filter(Boolean).join(" · ");
  // Kept short: search results truncate around 155 characters, and the cat's own
  // traits are what earns the click. The home page carries the Metro Manila reach.
  const description = traits
    ? `${name} — ${traits}. Available for adoption or fostering through AGILA at Ateneo de Manila University, Quezon City.`
    : `${name} is available for adoption or fostering through AGILA at Ateneo de Manila University, Quezon City.`;
  const images = cat.photo_url ? [cat.photo_url] : undefined;

  return {
    title: name,
    description,
    openGraph: { type: "article", title: name, description, images },
    twitter: { card: "summary_large_image", title: name, description, images },
  };
}

export default async function CatalogDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [cat, links] = await Promise.all([getCat(id), getLinks()]);

  if (!cat) notFound();

  const healthRecords = await repo
    .findCatHealthRecords({ cat_id: cat.id })
    .catch(() => []);

  return (
    <CatalogDetailScreen
      cat={cat}
      healthRecord={healthRecords[0] ?? null}
      adoptFosterUrl={links.adoptFoster}
    />
  );
}
