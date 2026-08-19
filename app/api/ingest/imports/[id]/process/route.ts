import { NextResponse } from "next/server";
import { z } from "zod";

import { processImportSlice } from "@/features/imports/process-slice";
import { withBearerAuth } from "@/lib/api/bearer";

export const maxDuration = 30;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withBearerAuth(request, async () => {
    const { id } = await context.params;
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ogiltig import." }, { status: 400 });
    }

    const result = await processImportSlice(parsed.data);
    const status = result.status === "error" ? 400 : 200;
    return NextResponse.json(result, { status });
  });
}
