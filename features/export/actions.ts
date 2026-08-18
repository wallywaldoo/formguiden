"use server";

import { revalidatePath } from "next/cache";

import {
  getExportDownloadUrl,
  processExportJob,
} from "@/features/export/process-export";
import { graphqlRequest } from "@/lib/graphql/client";
import { INSERT_AUDIT_EVENT } from "@/lib/graphql/mutations/profile";
import { INSERT_EXPORT_JOB } from "@/lib/graphql/mutations/coaching";
import { GET_EXPORT_JOB } from "@/lib/graphql/queries/coaching";
import { createNhostClient } from "@/lib/nhost/server";

export type ExportActionResult = {
  error?: string;
  jobId?: string;
  downloadUrl?: string;
};

async function requireUserId() {
  const nhost = await createNhostClient();
  const userId = nhost.getUserSession()?.user?.id;
  if (!userId) {
    throw new Error("Du är inte inloggad.");
  }
  return userId;
}

export async function requestExportAction(): Promise<ExportActionResult> {
  try {
    await requireUserId();
    const created = await graphqlRequest<{
      insert_data_export_jobs_one: { id: string };
    }>(INSERT_EXPORT_JOB);
    const jobId = created.insert_data_export_jobs_one.id;
    await graphqlRequest(INSERT_AUDIT_EVENT, {
      action: "export.request",
      entity_type: "data_export_job",
      entity_id: jobId,
    });
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
    await requireUserId();
    const result = await processExportJob(jobId);
    if (result.status === "error") {
      return { error: result.error, jobId };
    }
    const job = await graphqlRequest<{
      data_export_jobs_by_pk: { storage_file_id: string | null } | null;
    }>(GET_EXPORT_JOB, { id: jobId });
    const fileId = job.data_export_jobs_by_pk?.storage_file_id;
    if (!fileId) {
      return { jobId, error: "Exportfilen saknas." };
    }
    const downloadUrl = await getExportDownloadUrl(fileId);
    revalidatePath("/settings/privacy");
    return { jobId, downloadUrl: downloadUrl ?? undefined };
  } catch (error) {
    return {
      jobId,
      error: error instanceof Error ? error.message : "Exporten misslyckades.",
    };
  }
}
