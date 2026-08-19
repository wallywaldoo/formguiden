import { NextResponse } from "next/server";
import { z } from "zod";

import { startImportFromUploadedFiles } from "@/features/imports/start-import";
import { withBearerAuth } from "@/lib/api/bearer";
import { isOverIngestRateLimit } from "@/lib/api/ingest-limit";
import sql from "@/lib/db";
import { provenanceSchema } from "@/lib/import/garmin-connect/schema";

export const maxDuration = 30;

const bodySchema = z.object({
  files: z
    .array(
      z.object({
        storageFileId: z.string().uuid(),
        filename: z.string().min(1).max(255),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        size: z
          .number()
          .int()
          .positive()
          .max(25 * 1024 * 1024),
        mimeType: z.string().max(255).optional(),
      }),
    )
    .min(1)
    .max(20),
  provider: z.enum(["garmin-file", "garmin-connect"]).optional(),
  provenance: provenanceSchema.optional(),
});

export async function POST(request: Request) {
  return withBearerAuth(request, async () => {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Ogiltig begäran." },
        { status: 400 },
      );
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = await sql`
      SELECT created_at FROM data_imports
      WHERE created_at >= ${since}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    if (isOverIngestRateLimit(recent.map((row) => row.created_at as string))) {
      return NextResponse.json(
        { error: "För många automatiska importer idag. Försök imorgon." },
        { status: 429 },
      );
    }

    const result = await startImportFromUploadedFiles({
      files: parsed.data.files.map((file) => ({
        id: file.storageFileId,
        name: file.filename,
        type: file.mimeType,
        size: file.size,
        sha256: file.sha256,
      })),
      provider: parsed.data.provider,
      provenance: parsed.data.provenance
        ? { garminConnect: parsed.data.provenance }
        : undefined,
    });

    if (result.error || !result.importId) {
      return NextResponse.json(
        { error: result.error ?? "Kunde inte starta importen." },
        { status: 400 },
      );
    }

    return NextResponse.json({ importId: result.importId });
  });
}
