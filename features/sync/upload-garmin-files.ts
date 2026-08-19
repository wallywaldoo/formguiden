import { MAX_UPLOAD_BYTES } from "@/lib/import/limits";

// TODO [migration]: Reimplement file upload using Vercel Blob or a direct
// server action instead of Nhost Storage.

const ACCEPT_HINT = /(\.fit|\.tcx|\.gpx|\.csv|\.zip|\.db|\.json)$/i;

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

  for (const file of selected) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`${file.name} är större än 25 MiB.`);
    }
  }

  throw new Error(
    "Filuppladdning är inte implementerad ännu i den nya databasen.",
  );
}
