import { NextResponse } from "next/server";
import { z } from "zod";

import { commitImport } from "@/features/imports/commit-import";
import { withBearerAuth } from "@/lib/api/bearer";
import { graphqlRequest } from "@/lib/graphql/client";
import {
  GET_IMPORT,
  GET_LAST_COMMITTED_PROVENANCE,
} from "@/lib/graphql/queries/imports";
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

    const data = await graphqlRequest<{
      data_imports_by_pk: { id: string; status: string } | null;
      import_files: Array<{ source_provenance: unknown }>;
    }>(GET_IMPORT, { id: parsed.data });

    const importRow = data.data_imports_by_pk;
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

    if (!["preview_ready", "partial"].includes(importRow.status)) {
      return NextResponse.json({
        importId: parsed.data,
        importStatus: importRow.status,
        committed: false,
        reason: "not_ready",
      });
    }

    const current = data.import_files
      .map((file) => extractGarminConnectProvenance(file.source_provenance))
      .find((value) => value !== null);

    const previous = await graphqlRequest<{
      import_files: Array<{ source_provenance: unknown }>;
    }>(GET_LAST_COMMITTED_PROVENANCE);

    const lastApproved = previous.import_files
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
