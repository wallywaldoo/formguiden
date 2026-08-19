import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

import sql from "@/lib/db";

function splitSqlStatements(source: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inDollar = false;
  let i = 0;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (!inSingle && !inDouble && ch === "$" && next === "$") {
      inDollar = !inDollar;
      current += "$$";
      i += 2;
      continue;
    }

    if (!inDouble && !inDollar && ch === "'" && source[i - 1] !== "\\") {
      inSingle = !inSingle;
      current += ch;
      i += 1;
      continue;
    }

    if (!inSingle && !inDollar && ch === '"' && source[i - 1] !== "\\") {
      inDouble = !inDouble;
      current += ch;
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble && !inDollar && ch === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

function isIgnorableMigrationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("already exists") ||
    message.includes("duplicate key value") ||
    message.includes("multiple primary keys") ||
    message.includes("relation") && message.includes("already exists") ||
    message.includes("index") && message.includes("already exists") ||
    message.includes("constraint") && message.includes("already exists") ||
    message.includes("trigger") && message.includes("already exists")
  );
}

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

    const statements = splitSqlStatements(schema);
    let applied = 0;
    let skipped = 0;

    for (const statement of statements) {
      try {
        await sql.unsafe(`${statement};`);
        applied += 1;
      } catch (error) {
        if (isIgnorableMigrationError(error)) {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Schema applied. ${applied} statements ran, ${skipped} were already present.`,
    });
  } catch (error) {
    console.error("Schema migration failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 },
    );
  }
}
