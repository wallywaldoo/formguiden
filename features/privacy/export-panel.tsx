"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  processExportAction,
  requestExportAction,
} from "@/features/export/actions";
import { EXPORT_STATUS_LABELS } from "@/features/recommendations/labels";

type ExportJob = {
  id: string;
  status: string;
  error_summary: string | null;
  created_at: string;
  completed_at: string | null;
};

export function ExportPanel({ jobs }: { jobs: ExportJob[] }) {
  const [items, setItems] = useState(jobs);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setError(null);
            const created = await requestExportAction();
            if (created.error || !created.jobId) {
              setError(created.error ?? "Kunde inte starta exporten.");
              return;
            }
            const result = await processExportAction(created.jobId);
            if (result.error) {
              setError(result.error);
              return;
            }
            setItems((current) => [
              {
                id: created.jobId!,
                status: result.downloadUrl ? "ready" : "processing",
                error_summary: null,
                created_at: new Date().toISOString(),
                completed_at: result.downloadUrl
                  ? new Date().toISOString()
                  : null,
              },
              ...current,
            ]);
            if (result.downloadUrl) {
              window.location.href = result.downloadUrl;
            }
          });
        }}
      >
        {pending ? "Exporterar…" : "Exportera min data"}
      </Button>
      {items.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {items.map((job) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <span>{new Date(job.created_at).toLocaleString("sv-SE")}</span>
              <span className="text-muted-foreground">
                {EXPORT_STATUS_LABELS[job.status] ?? job.status}
                {job.error_summary ? ` — ${job.error_summary}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Inga exporter ännu.</p>
      )}
      <p className="text-xs text-muted-foreground">
        ZIP med JSON/CSV och Garmin-filer (max 20 MiB totalt).
        Nedladdningslänken gäller några minuter.
      </p>
    </div>
  );
}
