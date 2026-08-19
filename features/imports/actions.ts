"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { commitImport } from "@/features/imports/commit-import";
import {
  startImportFromUploadedFiles,
  uploadedFileSchema,
} from "@/features/imports/start-import";
import { graphqlRequest } from "@/lib/graphql/client";
import { INSERT_AUDIT_EVENT } from "@/lib/graphql/mutations/profile";
import {
  DELETE_PREVIEWS,
  UPDATE_DATA_IMPORT,
} from "@/lib/graphql/mutations/imports";
import { createNhostClient } from "@/lib/nhost/server";

const importIdSchema = z.string().uuid();

export type ImportActionResult = {
  error?: string;
  importId?: string;
};

async function requireUserId() {
  const nhost = await createNhostClient();
  const userId = nhost.getUserSession()?.user?.id;
  if (!userId) {
    throw new Error("Du är inte inloggad.");
  }
  return { nhost, userId };
}

export async function startImportAction(
  files: z.infer<typeof uploadedFileSchema>[],
): Promise<ImportActionResult> {
  const result = await startImportFromUploadedFiles({ files });
  if (result.importId) {
    revalidatePath("/import");
  }
  return result;
}

export async function confirmImportAction(
  importId: string,
): Promise<ImportActionResult> {
  const parsedId = importIdSchema.safeParse(importId);
  if (!parsedId.success) {
    return { error: "Ogiltig import." };
  }

  try {
    const result = await commitImport(parsedId.data);
    if (result.error || !result.importId) {
      return result;
    }
    revalidatePath("/import");
    revalidatePath(`/import/${parsedId.data}`);
    revalidatePath(`/import/${parsedId.data}/landed`);
    revalidatePath("/overview");
    revalidatePath("/running");
    revalidatePath("/report");
    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte bekräfta importen.",
    };
  }
}

export async function abandonImportAction(
  importId: string,
): Promise<ImportActionResult> {
  const parsedId = importIdSchema.safeParse(importId);
  if (!parsedId.success) {
    return { error: "Ogiltig import." };
  }

  try {
    await requireUserId();
    await graphqlRequest(DELETE_PREVIEWS, { import_id: parsedId.data });
    await graphqlRequest(UPDATE_DATA_IMPORT, {
      id: parsedId.data,
      set: { status: "abandoned" },
    });
    await graphqlRequest(INSERT_AUDIT_EVENT, {
      action: "import.abandon",
      entity_type: "data_imports",
      entity_id: parsedId.data,
    });
    revalidatePath("/import");
    return { importId: parsedId.data };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Kunde inte avbryta importen.",
    };
  }
}
