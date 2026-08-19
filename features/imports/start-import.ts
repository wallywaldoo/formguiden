import { z } from "zod";

import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { ImportProviderId } from "@/lib/import/adapters/types";
import {
  IMPORT_SOURCE,
  MAX_UPLOAD_BYTES,
  MIN_UPLOAD_BYTES,
} from "@/lib/import/limits";

export const uploadedFileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(255),
  type: z.string().max(255).optional(),
  size: z.number().int().min(MIN_UPLOAD_BYTES).max(MAX_UPLOAD_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const ingestProviders = ["garmin-file", "garmin-connect"] as const;

export type StartImportInput = {
  files: z.infer<typeof uploadedFileSchema>[];
  provider?: ImportProviderId;
  provenance?: Record<string, unknown>;
};

export type StartImportResult = {
  error?: string;
  importId?: string;
};

export async function startImportFromUploadedFiles(
  input: StartImportInput,
): Promise<StartImportResult> {
  const parsed = z
    .array(uploadedFileSchema)
    .min(1)
    .max(20)
    .safeParse(input.files);
  if (!parsed.success) {
    return { error: "Välj minst en giltig fil (max 20, 25 MiB styck)." };
  }

  const provider = ingestProviders.includes(
    input.provider as (typeof ingestProviders)[number],
  )
    ? (input.provider as (typeof ingestProviders)[number])
    : IMPORT_SOURCE;

  const ok = await getSession();
  if (!ok) {
    return { error: "Du är inte inloggad." };
  }

  let importId: string | undefined;
  try {
    const created = await sql`
      INSERT INTO data_imports (provider, status, file_count)
      VALUES (${provider}, 'uploaded', ${parsed.data.length})
      RETURNING id
    `;
    importId = created[0]!.id as string;

    for (const file of parsed.data) {
      // Check if this hash is already committed (duplicate detection)
      const committed = await sql`
        SELECT id FROM import_files WHERE sha256 = ${file.sha256} AND status = 'committed' LIMIT 1
      `;
      const fileStatus = committed.length > 0 ? "duplicate" : "pending";

      // Look up the storage path from import_files (previously uploaded via ingest API)
      // For files uploaded via the upload endpoint, the storage_path is stored there.
      // For single-user: we store bytes via storage_path referencing the filesystem or
      // we trust the upload endpoint to have stored the file.
      const inserted = await sql`
        INSERT INTO import_files
          (import_id, storage_path, original_filename, declared_mime_type,
           detected_kind, byte_size, sha256, status)
        VALUES (
          ${importId}, ${file.id}, ${file.name}, ${file.type ?? null},
          null, ${file.size}, ${file.sha256}, ${fileStatus}
        )
        RETURNING id
      `;
      if (input.provenance) {
        await sql`
          UPDATE import_files
          SET source_provenance = ${JSON.stringify(input.provenance)}
          WHERE id = ${inserted[0]!.id}
        `;
      }
    }

    await sql`
      INSERT INTO import_jobs (import_id, cursor)
      VALUES (${importId}, '{}')
    `;
    await sql`
      UPDATE data_imports SET status = 'queued' WHERE id = ${importId}
    `;

    return { importId };
  } catch (error) {
    if (importId) {
      await sql`
        UPDATE data_imports SET
          status = 'failed',
          error_summary = ${error instanceof Error ? error.message : "Kunde inte starta importen."}
        WHERE id = ${importId}
      `.catch(() => undefined);
    }
    return {
      error:
        error instanceof Error ? error.message : "Kunde inte starta importen.",
    };
  }
}
