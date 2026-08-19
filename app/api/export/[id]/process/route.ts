import { NextResponse } from "next/server";

import { processExportJob } from "@/features/export/process-export";
import { getSession } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ok = await getSession();
  if (!ok) {
    return NextResponse.json(
      { error: "Du är inte inloggad." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const result = await processExportJob(id);
  const status = result.status === "error" ? 400 : 200;
  return NextResponse.json(result, { status });
}
