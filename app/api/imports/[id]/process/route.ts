import { NextResponse } from "next/server";

import { processImportSlice } from "@/features/imports/process-slice";
import { getSessionUserId } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Du är inte inloggad." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const result = await processImportSlice(id);
  const status = result.status === "error" ? 400 : 200;
  return NextResponse.json(result, { status });
}
