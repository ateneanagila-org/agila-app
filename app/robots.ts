import type { MetadataRoute } from "next";

// Trailing slashes are stripped: a value like "https://example.com/" would make
// every joined URL contain a double slash, which crawlers treat as a distinct
// (and 404-ing) URL. Cheap insurance against an env var set by someone else.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/login", "/api", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
