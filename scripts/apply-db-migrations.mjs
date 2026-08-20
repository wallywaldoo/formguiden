#!/usr/bin/env node
/**
 * Apply idempotent SQL files in db/migrations/ against POSTGRES_URL.
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-db-migrations.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const migrationsDir = join(process.cwd(), "db", "migrations");
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("POSTGRES_URL is not set.");
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log("No migrations to apply.");
  process.exit(0);
}

const url = new URL(connectionString);
const sslMode = url.searchParams.get("sslmode");
const sql = postgres(connectionString, {
  ssl:
    sslMode === "require" || process.env.NODE_ENV === "production"
      ? "require"
      : false,
  max: 1,
});

try {
  await sql`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  for (const filename of files) {
    const applied = await sql`
      SELECT 1 FROM public.schema_migrations WHERE filename = ${filename} LIMIT 1
    `;
    if (applied.length > 0) {
      console.log(`skip ${filename}`);
      continue;
    }

    const body = readFileSync(join(migrationsDir, filename), "utf8");
    console.log(`apply ${filename} ...`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`
        INSERT INTO public.schema_migrations (filename) VALUES (${filename})
      `;
    });
    console.log(`done ${filename}`);
  }

  console.log("Migrations complete.");
} finally {
  await sql.end();
}
