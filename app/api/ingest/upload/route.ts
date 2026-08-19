import { NextResponse } from "next/server";

import { withBearerAuth } from "@/lib/api/bearer";
import { GARMIN_IMPORTS_BUCKET } from "@/lib/constants";
import { getNhostConnection } from "@/lib/nhost/config";

export const maxDuration = 30;

const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Receives a file via multipart and stores it in Nhost Storage using the
 * admin secret (server-side only). Returns the storage file ID so the caller
 * can reference it in /api/ingest/imports.
 *
 * This exists because Nhost Storage's own authz rules on the Starter plan
 * reject user-JWT uploads to custom buckets.
 */
export async function POST(request: Request) {
  return withBearerAuth(request, async ({ userId }) => {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Begäran måste vara multipart/form-data." },
        { status: 400 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Kunde inte läsa multipart-data." },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File) && !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Fältet 'file' saknas eller är ogiltigt." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Filen är för stor (max ${MAX_FILE_SIZE / 1024 / 1024} MiB).` },
        { status: 400 },
      );
    }

    const adminSecret = process.env.NHOST_ADMIN_SECRET;
    if (!adminSecret) {
      return NextResponse.json(
        { error: "Serverkonfiguration saknas." },
        { status: 500 },
      );
    }

    const connection = getNhostConnection();
    const storageUrl = `https://${connection.subdomain}.storage.${connection.region}.nhost.run/v1/files`;

    const body = new FormData();
    body.append("bucket-id", GARMIN_IMPORTS_BUCKET);
    const filename =
      file instanceof File ? file.name : (formData.get("filename") as string) ?? "upload";
    body.append("file[]", file, filename);
    body.append(
      "metadata[]",
      new Blob(
        [JSON.stringify({ uploaded_by_user_id: userId })],
        { type: "application/json" },
      ),
      "",
    );

    const storageResponse = await fetch(storageUrl, {
      method: "POST",
      headers: { "x-hasura-admin-secret": adminSecret },
      body,
    });

    if (!storageResponse.ok) {
      const text = await storageResponse.text().catch(() => "");
      console.error("Storage upload failed:", storageResponse.status, text);
      return NextResponse.json(
        { error: "Kunde inte lagra filen." },
        { status: 502 },
      );
    }

    const result = await storageResponse.json();
    const processed = (result.processedFiles ?? [])[0];
    if (!processed?.id) {
      return NextResponse.json(
        { error: "Nhost Storage returnerade inget fil-ID." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      id: processed.id,
      name: processed.name ?? filename,
      size: processed.size ?? file.size,
      mimeType: processed.mimeType ?? null,
    });
  });
}
