"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { commitImport } from "@/features/imports/commit-import";
import {
  startImportFromUploadedFiles,
  uploadedFileSchema,
} from "@/features/imports/start-import";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

const importIdSchema = z.string().uuid();

export type ImportActionResult = {
  error?: string;
  importId?: string;
};

async function requireSession(): Promise<void> {
  const ok = await getSession();
  if (!ok) throw new Error("Du är inte inloggad.");
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
    await requireSession();
    // Cascade delete removes lap previews too
    await sql`DELETE FROM activity_previews WHERE import_id = ${parsedId.data}`;
    await sql`DELETE FROM daily_health_metric_previews WHERE import_id = ${parsedId.data}`;
    await sql`DELETE FROM body_measurement_previews WHERE import_id = ${parsedId.data}`;
    await sql`UPDATE data_imports SET status = 'abandoned' WHERE id = ${parsedId.data}`;
    revalidatePath("/import");
    return { importId: parsedId.data };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Kunde inte avbryta importen.",
    };
  }
}
