import { NextResponse } from "next/server";

import { withBearerAuth } from "@/lib/api/bearer";
import { getNhostConnection } from "@/lib/nhost/config";

export const maxDuration = 30;

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ADMIN_INSERT_FILE = /* GraphQL */ `
  mutation AdminInsertFile(
    $bucket_id: String!
    $name: String!
    $size: Int!
    $mime_type: String!
    $uploaded_by_user_id: uuid!
    $is_uploaded: Boolean!
  ) {
    insert_storage_files_one(
      object: {
        bucket_id: $bucket_id
        name: $name
        size: $size
        mime_type: $mime_type
        uploaded_by_user_id: $uploaded_by_user_id
        is_uploaded: $is_uploaded
      }
    ) {
      id
      name
      size
      mime_type
    }
  }
`;

/**
 * Receives a file via multipart and creates a storage.files record directly
 * through the Hasura admin API. The file bytes are *not* persisted to S3 —
 * they will be re-uploaded through the process step where the server reads
 * them from the request. This endpoint exists because Nhost Storage's REST
 * upload API rejects user-JWT uploads on the Starter plan.
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
    if (!file || typeof file === "string") {
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
    const hasuraUrl = `https://${connection.subdomain}.hasura.${connection.region}.nhost.run/v1/graphql`;

    const filename =
      ("name" in file && typeof file.name === "string" ? file.name : null) ??
      (formData.get("filename") as string) ??
      "upload";

    const mimeType =
      ("type" in file && typeof file.type === "string" ? file.type : null) ??
      "application/octet-stream";

    // Create storage.files record directly via Hasura admin API
    const gqlResponse = await fetch(hasuraUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hasura-Admin-Secret": adminSecret,
      },
      body: JSON.stringify({
        query: ADMIN_INSERT_FILE,
        variables: {
          bucket_id: "garmin-imports",
          name: filename,
          size: file.size,
          mime_type: mimeType,
          uploaded_by_user_id: userId,
          is_uploaded: true,
        },
      }),
    });

    if (!gqlResponse.ok) {
      console.error("Hasura insert failed:", gqlResponse.status);
      return NextResponse.json(
        { error: "Kunde inte skapa filpost." },
        { status: 502 },
      );
    }

    const gqlResult = await gqlResponse.json();
    const inserted = gqlResult?.data?.insert_storage_files_one;
    if (!inserted?.id) {
      console.error("Hasura insert returned no id:", JSON.stringify(gqlResult));
      return NextResponse.json(
        { error: "Hasura returnerade inget fil-ID." },
        { status: 502 },
      );
    }

    // Store file bytes as base64 in a temporary cache for the process step
    // to retrieve. We use a Hasura column for this since S3 upload isn't
    // available via the user path.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = Buffer.from(bytes).toString("base64");

    // Store inline bytes in the file metadata so process-slice can read them
    const metaResponse = await fetch(hasuraUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hasura-Admin-Secret": adminSecret,
      },
      body: JSON.stringify({
        query: `mutation UpdateFileMeta($id: uuid!, $metadata: jsonb) {
          update_storage_files_by_pk(pk_columns: {id: $id}, _set: {metadata: $metadata}) { id }
        }`,
        variables: {
          id: inserted.id,
          metadata: { inline_base64: base64 },
        },
      }),
    });

    if (!metaResponse.ok) {
      console.error("Metadata update failed:", metaResponse.status);
    }

    return NextResponse.json({
      id: inserted.id,
      name: inserted.name ?? filename,
      size: inserted.size ?? file.size,
      mimeType: inserted.mime_type ?? mimeType,
    });
  });
}
