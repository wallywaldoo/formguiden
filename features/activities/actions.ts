"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { graphqlRequest } from "@/lib/graphql/client";
import { UPDATE_ACTIVITY_NOTES } from "@/lib/graphql/mutations/activities";
import { createNhostClient } from "@/lib/nhost/server";

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

  const nhost = await createNhostClient();
  if (!nhost.getUserSession()?.user?.id) {
    return { error: "Du är inte inloggad." };
  }

  try {
    await graphqlRequest(UPDATE_ACTIVITY_NOTES, {
      id: parsed.data.id,
      notes: parsed.data.notes.length > 0 ? parsed.data.notes : null,
    });
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
