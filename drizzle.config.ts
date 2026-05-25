import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/*",
  schemaFilter: ["public"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL!,
  },
  introspect: {
    casing: "preserve",
  },
});
