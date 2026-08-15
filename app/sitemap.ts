import type { MetadataRoute } from "next";
import * as repo from "@/lib/repo/cats.repo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Re-generated hourly rather than per-request; the catalog changes slowly and
// this endpoint is hit by crawlers, not people.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const cats = await repo.findAdoptableCats({ is_adoptable: true });

    // The listing page genuinely changed when its most recently edited cat did.
    // Emitting `new Date()` here would claim a change on every regeneration.
    const timestamps = cats
      .map((cat) => cat.last_updated_at)
      .filter((d): d is Date => d instanceof Date);
    const listingUpdatedAt = timestamps.length
      ? new Date(Math.max(...timestamps.map((d) => d.getTime())))
      : undefined;

    return [
      { url: SITE_URL, lastModified: listingUpdatedAt },
      ...cats.map((cat) => ({
        url: `${SITE_URL}/catalog/${cat.id}`,
        lastModified: cat.last_updated_at ?? undefined,
      })),
    ];
  } catch (error) {
    // A database blip must not take the sitemap down entirely — an empty
    // sitemap tells crawlers the catalog is gone. Note this catch is deliberate
    // and is the OPPOSITE call to the one made for a single cat page in Task 7:
    // there, swallowing an error made one cat look permanently deleted; here,
    // throwing would take down the whole index.
    console.error("[Sitemap] Failed to load adoptable cats:", error);
    // No fabricated lastModified on the degraded path.
    return [{ url: SITE_URL }];
  }
}
