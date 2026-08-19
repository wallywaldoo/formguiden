import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

import sql from "@/lib/db";

/**
 * One-shot schema migration endpoint.
 * POST /api/db-migrate with Authorization: Bearer <INGEST_API_KEY>
 * Runs db/schema.sql against the connected Postgres database.
 * Safe to run multiple times — schema uses IF NOT EXISTS.
 */
export async function POST(request: Request) {
  const apiKey = process.env.INGEST_API_KEY;
  const auth = request.headers.get("authorization");
  if (!apiKey || auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const schemaPath = join(process.cwd(), "db", "schema.sql");
    const schema = await readFile(schemaPath, "utf8");

    // Run the schema as one script. It contains PL/pgSQL function bodies with
    // internal semicolons, so naive splitting breaks on RETURN/END statements.
    await sql.unsafe(schema);

    return NextResponse.json({
      ok: true,
      message: "Schema applied successfully.",
    });
  } catch (error) {
    console.error("Schema migration failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 },
    );
  }
}
