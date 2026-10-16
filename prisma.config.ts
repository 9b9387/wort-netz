import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

// The `datasource` block is only required by the migration/introspection
// commands, so keep it optional: `prisma generate` then also works in
// environments that provide no database URL at all (for example a Vercel
// preview build without `DIRECT_URL`).
const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(datasourceUrl ? { datasource: { url: datasourceUrl } } : {}),
});
