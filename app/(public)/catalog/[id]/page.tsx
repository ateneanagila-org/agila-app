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
  // Database errors deliberately propagate. Swallowing them into `null` makes
  // notFound() fire, so a transient outage becomes a 404 — indistinguishable
  // from a permanently deleted cat. Crawlers deindex on 404 and retry on 5xx,
  // which would defeat the SEO work this page exists for. 404 is reserved for a
  // non-UUID id or a genuinely empty result.
  const rows = await repo.findAdoptableCats({ id, is_adoptable: true });
  return rows[0] ?? null;
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
    // Resolved against metadataBase (NEXT_PUBLIC_SITE_URL), so it names the
    // canonical host. The site answers on both the apex and www — the apex
    // 308s to www — and without this, redirects are the only signal telling
    // Google which host owns the page.
    alternates: { canonical: `/catalog/${id}` },
    openGraph: {
      type: "article",
      siteName: "AGILA CATalog",
      title: name,
      description,
      locale: "en_PH",
      images,
    },
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
