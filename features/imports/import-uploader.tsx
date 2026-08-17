"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { startImportAction } from "@/features/imports/actions";
import { GARMIN_IMPORTS_BUCKET } from "@/lib/constants";
import { MAX_UPLOAD_BYTES } from "@/lib/import/limits";
import { createBrowserNhostClient } from "@/lib/nhost/browser";

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function ImportUploader() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);

    try {
      const nhost = createBrowserNhostClient();
      if (!nhost.getUserSession()) {
        throw new Error("Sessionen saknas. Logga in igen.");
      }
      const uploaded: Array<{
        id: string;
        name: string;
        type: string;
        size: number;
        sha256: string;
      }> = [];
      for (const [index, file] of selected.entries()) {
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`${file.name} är större än 25 MiB.`);
        }
        const sha256 = await sha256Hex(file);
        const response = await nhost.storage.uploadFiles({
          "bucket-id": GARMIN_IMPORTS_BUCKET,
          "file[]": [file],
        });
        const stored = response.body.processedFiles?.[0];
        if (response.status !== 201 || !stored?.id) {
          throw new Error(`Kunde inte ladda upp ${file.name}.`);
        }
        uploaded.push({
          id: stored.id,
          name: stored.name ?? file.name,
          type: stored.mimeType ?? file.type,
          size: stored.size ?? file.size,
          sha256,
        });
        setProgress(Math.round(((index + 1) / selected.length) * 100));
      }

      const result = await startImportAction(uploaded);
      if (result.error || !result.importId) {
        throw new Error(result.error ?? "Kunde inte skapa importen.");
      }
      router.push(`/import/${result.importId}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Uppladdningen misslyckades.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild disabled={busy}>
          <label className="cursor-pointer">
            {busy ? "Laddar upp…" : "Välj Garmin-filer"}
            <input
              type="file"
              className="sr-only"
              multiple
              disabled={busy}
              accept=".fit,.tcx,.gpx,.csv,.zip,application/zip,application/gpx+xml,text/csv"
              onChange={onChange}
            />
          </label>
        </Button>
        <p className="text-sm text-muted-foreground">
          FIT, TCX, GPX, CSV eller ZIP. Max 25 MiB per fil. Ingen
          Garmin-inloggning.
        </p>
      </div>
      {progress != null ? <Progress value={progress} /> : null}
    </div>
  );
}
