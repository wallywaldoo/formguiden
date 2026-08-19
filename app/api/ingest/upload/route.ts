import { NextResponse } from "next/server";

import { withBearerAuth } from "@/lib/api/bearer";

export const maxDuration = 30;

const MAX_FILE_SIZE = 25 * 1024 * 1024;

// TODO [migration]: Reimplement file upload using local storage or Vercel Blob
// instead of Nhost Storage / Hasura admin API.

export async function POST(request: Request) {
  return withBearerAuth(request, async () => {
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
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Fältet 'file' saknas eller är ogiltigt." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Filen är för stor (max ${MAX_FILE_SIZE / 1024 / 1024} MiB).`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Filuppladdning är inte implementerad ännu i den nya databasen.",
      },
      { status: 501 },
    );
  });
}
