import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { startImportAction } from "@/features/imports/actions";
import { GARMIN_IMPORTS_BUCKET } from "@/lib/constants";
import { MAX_UPLOAD_BYTES } from "@/lib/import/limits";
import { createNhostClient } from "@/lib/nhost/server";

export const maxDuration = 60;

function sha256Hex(bytes: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

function filesFromForm(form: FormData): File[] {
  const collected: File[] = [];
  for (const [key, value] of form.entries()) {
    if (
      value instanceof File &&
      value.size > 0 &&
      (key === "garmin" || key === "file" || key === "files")
    ) {
      collected.push(value);
    }
  }
  if (collected.length === 0) {
    for (const value of form.values()) {
      if (value instanceof File && value.size > 0) {
        collected.push(value);
      }
    }
  }
  return collected.slice(0, 20);
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/import", request.url));
}

export async function POST(request: Request) {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", "/import");

  try {
    const nhost = await createNhostClient();
    if (!nhost.getUserSession()?.user?.id) {
      return NextResponse.redirect(login, 303);
    }

    const form = await request.formData();
    const files = filesFromForm(form);
    if (files.length === 0) {
      return NextResponse.redirect(new URL("/import", request.url), 303);
    }

    const uploaded: Array<{
      id: string;
      name: string;
      type: string;
      size: number;
      sha256: string;
    }> = [];

    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        const failed = new URL("/import", request.url);
        failed.searchParams.set("error", `${file.name} är större än 25 MiB.`);
        return NextResponse.redirect(failed, 303);
      }
      const bytes = await file.arrayBuffer();
      const response = await nhost.storage.uploadFiles({
        "bucket-id": GARMIN_IMPORTS_BUCKET,
        "file[]": [file],
      });
      const stored = response.body.processedFiles?.[0];
      if (response.status !== 201 || !stored?.id) {
        const failed = new URL("/import", request.url);
        failed.searchParams.set("error", `Kunde inte ta emot ${file.name}.`);
        return NextResponse.redirect(failed, 303);
      }
      uploaded.push({
        id: stored.id,
        name: stored.name ?? file.name,
        type: stored.mimeType ?? file.type,
        size: stored.size ?? file.size,
        sha256: sha256Hex(bytes),
      });
    }

    const started = await startImportAction(uploaded);
    if (started.error || !started.importId) {
      const failed = new URL("/import", request.url);
      failed.searchParams.set(
        "error",
        started.error ?? "Kunde inte starta importen.",
      );
      return NextResponse.redirect(failed, 303);
    }

    return NextResponse.redirect(
      new URL(`/import/${started.importId}`, request.url),
      303,
    );
  } catch {
    return NextResponse.redirect(login, 303);
  }
}
