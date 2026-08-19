"use server";

import { revalidatePath } from "next/cache";

import {
  getExportDownloadUrl,
  processExportJob,
} from "@/features/export/process-export";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

export type ExportActionResult = {
  error?: string;
  jobId?: string;
  downloadUrl?: string;
};

async function requireSession(): Promise<void> {
  const ok = await getSession();
  if (!ok) throw new Error("Du är inte inloggad.");
}

export async function requestExportAction(): Promise<ExportActionResult> {
  try {
    await requireSession();
    const created = await sql`
      INSERT INTO data_export_jobs (status) VALUES ('queued') RETURNING id
    `;
    const jobId = created[0]!.id as string;
    revalidatePath("/settings/privacy");
    return { jobId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Kunde inte starta exporten.",
    };
  }
}

export async function processExportAction(
  jobId: string,
): Promise<ExportActionResult> {
  try {
    await requireSession();
    const result = await processExportJob(jobId);
    if (result.status === "error") {
      return { error: result.error, jobId };
    }
    const downloadUrl = await getExportDownloadUrl(jobId);
    revalidatePath("/settings/privacy");
    return { jobId, downloadUrl: downloadUrl ?? undefined };
  } catch (error) {
    return {
      jobId,
      error: error instanceof Error ? error.message : "Exporten misslyckades.",
    };
  }
}
