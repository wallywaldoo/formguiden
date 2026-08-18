import { startImportAction } from "@/features/imports/actions";
import { GARMIN_IMPORTS_BUCKET } from "@/lib/constants";
import { MAX_UPLOAD_BYTES } from "@/lib/import/limits";
import { createBrowserNhostClient } from "@/lib/nhost/browser";

const ACCEPT_HINT = /(\.fit|\.tcx|\.gpx|\.csv|\.zip)$/i;

export async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isLikelyGarminFile(file: File): boolean {
  if (ACCEPT_HINT.test(file.name)) {
    return true;
  }
  return [
    "application/zip",
    "application/gpx+xml",
    "application/vnd.garmin.tcx+xml",
    "text/csv",
    "application/octet-stream",
  ].includes(file.type);
}

export async function uploadGarminFiles(
  files: File[],
): Promise<{ importId: string }> {
  const selected = files.filter((file) => file.size > 0);
  if (selected.length === 0) {
    throw new Error("Inga filer att hämta in.");
  }
  if (selected.length > 20) {
    throw new Error("Max 20 filer åt gången. Ta en ZIP om du har fler.");
  }

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

  for (const file of selected) {
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
  }

  const result = await startImportAction(uploaded);
  if (result.error || !result.importId) {
    throw new Error(result.error ?? "Kunde inte skapa importen.");
  }
  return { importId: result.importId };
}
