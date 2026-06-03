import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
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
  async rewrites() {
    return [
      {
        source: "/dashboard/overview",
        destination: "/overview",
      },
      {
        source: "/dashboard/tnvr",
        destination: "/tnvr",
      },
      {
        source: "/dashboard/database",
        destination: "/database",
      },
      {
        source: "/dashboard/database/:path*",
        destination: "/database/:path*",
      },
      {
        source: "/dashboard/sessions",
        destination: "/sessions",
      },
      {
        source: "/dashboard/sessions/:path*",
        destination: "/sessions/:path*",
      },
    ];
  },
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
