import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The cat id moved from a search param to a route segment, so that the
      // [id] layout can resolve the cat on the server (layouts do not receive
      // searchParams). These keep links and bookmarks to the old shape working.
      // Redirects run before rewrites, so they take precedence over the
      // /dashboard/database/:path* rewrite below.
      ...["general", "medical", "interventions"].map((tab) => ({
        source: `/dashboard/database/${tab}`,
        has: [{ type: "query" as const, key: "id", value: "(?<catId>.*)" }],
        destination: `/dashboard/database/:catId/${tab}`,
        permanent: false,
      })),
      {
        source: "/catalog",
        destination: "/",
        permanent: false,
      },
      {
        source: "/catagalog",
        destination: "/",
        permanent: false,
      },
      {
        source: "/catagalog/:path*",
        destination: "/catalog/:path*",
        permanent: false,
      },
      {
        source: "/overview",
        destination: "/dashboard/overview",
        permanent: false,
      },
      {
        source: "/tnvr",
        destination: "/dashboard/tnvr",
        permanent: false,
      },
      {
        source: "/database",
        destination: "/dashboard/database",
        permanent: false,
      },
      {
        source: "/database/:path*",
        destination: "/dashboard/database/:path*",
        permanent: false,
      },
      {
        source: "/sessions",
        destination: "/dashboard/sessions",
        permanent: false,
      },
      {
        source: "/sessions/:path*",
        destination: "/dashboard/sessions/:path*",
        permanent: false,
      },
      {
        source: "/admin",
        destination: "/dashboard/admin",
        permanent: false,
      },
    ];
  },
  // No rewrites(). There used to be a set mapping /dashboard/x -> /x, and every
  // one of those destinations is a route that does not exist — the pages live at
  // /dashboard/*, and the redirects above are what carry the legacy /x URLs
  // there. They looked harmless only because a plain array is an afterFiles
  // rewrite, and afterFiles is evaluated AFTER literal routes: /dashboard/database
  // and /dashboard/database/general matched the filesystem first, so the rewrite
  // was never reached.
  //
  // afterFiles is evaluated BEFORE dynamic routes, though. The moment the cat
  // detail became /dashboard/database/[id]/general, the /dashboard/database/:path*
  // rewrite started winning: every cat detail was rewritten to /database/<id>/general
  // and 404'd. Re-adding any of these re-arms that for the next dynamic route.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mufvdhphtgvvrladaqlw.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;
