"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

const schema = z.object({
  id: z.string().uuid(),
  notes: z.string().trim().max(2000),
});

export async function updateActivityNotesAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = schema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: "Anteckningen kunde inte sparas." };
  }

  const ok = await getSession();
  if (!ok) {
    return { error: "Du är inte inloggad." };
  }

  try {
    await sql`
      UPDATE activities
      SET notes = ${parsed.data.notes.length > 0 ? parsed.data.notes : null}
      WHERE id = ${parsed.data.id}
    `;
    revalidatePath(`/running/${parsed.data.id}`);
    revalidatePath("/running");
    return {};
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte spara anteckningen.",
    };
  }
}
