import { NextResponse } from "next/server";
import { z } from "zod";

import { commitImport } from "@/features/imports/commit-import";
import { withBearerAuth } from "@/lib/api/bearer";
import sql from "@/lib/db";
import {
  extractGarminConnectProvenance,
  provenanceAllowsAutoCommit,
} from "@/lib/import/garmin-connect/autocommit";

export const maxDuration = 30;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withBearerAuth(request, async () => {
    const { id } = await context.params;
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ogiltig import." }, { status: 400 });
    }

    const importRows = await sql`
      SELECT id, status FROM data_imports WHERE id = ${parsed.data} LIMIT 1
    `;
    const importRow = importRows[0];
    if (!importRow) {
      return NextResponse.json(
        { error: "Importen hittades inte." },
        { status: 404 },
      );
    }

    if (importRow.status === "committed") {
      return NextResponse.json({
        importId: parsed.data,
        importStatus: "committed",
        committed: true,
        reason: "already_committed",
      });
    }

    if (!["preview_ready", "partial"].includes(importRow.status as string)) {
      return NextResponse.json({
        importId: parsed.data,
        importStatus: importRow.status,
        committed: false,
        reason: "not_ready",
      });
    }

    // Read provenance from import files to check auto-commit eligibility
    const currentFiles = await sql`
      SELECT source_provenance FROM import_files WHERE import_id = ${parsed.data}
    `;
    const current = currentFiles
      .map((file) => extractGarminConnectProvenance(file.source_provenance))
      .find((value) => value !== null);

    const previousFiles = await sql`
      SELECT source_provenance FROM import_files
      WHERE status = 'committed' AND source_provenance IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 20
    `;
    const lastApproved = previousFiles
      .map((file) => extractGarminConnectProvenance(file.source_provenance))
      .find((value) => value !== null);

    if (!provenanceAllowsAutoCommit(current, lastApproved)) {
      return NextResponse.json({
        importId: parsed.data,
        importStatus: importRow.status,
        committed: false,
        reason: lastApproved ? "provenance_mismatch" : "first_run",
      });
    }

    const result = await commitImport(parsed.data);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      importId: parsed.data,
      importStatus: "committed",
      committed: true,
      reason: "provenance_match",
    });
  });
}
