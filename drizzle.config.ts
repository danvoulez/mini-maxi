import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local only if POSTGRES_URL is not already set (i.e., local development)
// On Vercel, environment variables are injected directly
if (!process.env.POSTGRES_URL) {
  config({
    path: ".env.local",
  });
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // biome-ignore lint: Forbidden non-null assertion.
    url: process.env.POSTGRES_URL!,
  },
});
