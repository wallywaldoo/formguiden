import { z } from "zod";

import { GARMIN_IMPORTS_BUCKET } from "@/lib/constants";
import { graphqlRequest } from "@/lib/graphql/client";
import { INSERT_AUDIT_EVENT } from "@/lib/graphql/mutations/profile";
import {
  INSERT_DATA_IMPORT,
  INSERT_IMPORT_FILE,
  INSERT_IMPORT_JOB,
  UPDATE_DATA_IMPORT,
  UPDATE_IMPORT_FILE,
} from "@/lib/graphql/mutations/imports";
import {
  GET_COMMITTED_FILES_BY_HASH,
  GET_STORAGE_FILE,
} from "@/lib/graphql/queries/imports";
import type { ImportProviderId } from "@/lib/import/adapters/types";
import {
  IMPORT_SOURCE,
  MAX_UPLOAD_BYTES,
  MIN_UPLOAD_BYTES,
} from "@/lib/import/limits";
import { createNhostClient } from "@/lib/nhost/server";

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

  const nhost = await createNhostClient();
  const userId = nhost.getUserSession()?.user?.id;
  if (!userId) {
    return { error: "Du är inte inloggad." };
  }

  let importId: string | undefined;
  try {
    const created = await graphqlRequest<{
      insert_data_imports_one: { id: string };
    }>(INSERT_DATA_IMPORT, {
      provider,
      status: "uploaded",
      file_count: parsed.data.length,
    });
    importId = created.insert_data_imports_one.id;

    for (const file of parsed.data) {
      const meta = await graphqlRequest<{
        files_by_pk: {
          id: string;
          bucket_id: string;
          uploaded_by_user_id: string | null;
          name: string;
          size: number;
          mime_type: string | null;
        } | null;
      }>(GET_STORAGE_FILE, { id: file.id });
      const stored = meta.files_by_pk;
      if (
        !stored ||
        stored.bucket_id !== GARMIN_IMPORTS_BUCKET ||
        stored.uploaded_by_user_id !== userId ||
        stored.size !== file.size
      ) {
        throw new Error("En fil kunde inte kopplas till ditt konto.");
      }

      const committed = await graphqlRequest<{
        import_files: Array<{ id: string }>;
      }>(GET_COMMITTED_FILES_BY_HASH, { sha256: file.sha256 });

      const inserted = await graphqlRequest<{
        insert_import_files_one: { id: string };
      }>(INSERT_IMPORT_FILE, {
        import_id: importId,
        storage_file_id: file.id,
        original_filename: stored.name,
        declared_mime_type: stored.mime_type,
        detected_kind: null,
        byte_size: stored.size,
        sha256: file.sha256,
        status: committed.import_files.length > 0 ? "duplicate" : "pending",
      });
      if (input.provenance) {
        await graphqlRequest(UPDATE_IMPORT_FILE, {
          id: inserted.insert_import_files_one.id,
          set: { source_provenance: input.provenance },
        });
      }
    }

    await graphqlRequest(INSERT_IMPORT_JOB, {
      import_id: importId,
      cursor: {},
    });
    await graphqlRequest(UPDATE_DATA_IMPORT, {
      id: importId,
      set: { status: "queued" },
    });
    await graphqlRequest(INSERT_AUDIT_EVENT, {
      action: "import.uploaded",
      entity_type: "data_imports",
      entity_id: importId,
    });

    return { importId };
  } catch (error) {
    if (importId) {
      await graphqlRequest(UPDATE_DATA_IMPORT, {
        id: importId,
        set: {
          status: "failed",
          error_summary:
            error instanceof Error
              ? error.message
              : "Kunde inte starta importen.",
        },
      }).catch(() => undefined);
    }
    return {
      error:
        error instanceof Error ? error.message : "Kunde inte starta importen.",
    };
  }
}
