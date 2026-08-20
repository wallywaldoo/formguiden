"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fromDatetimeLocal } from "@/lib/analytics/dates";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
import { derivedPace } from "@/lib/import/normalize";
import { distanceToMeters } from "@/lib/units/convert";
import { activityEntrySchema } from "@/lib/validation/logging";

export type ActivityActionState = { error?: string; ok?: boolean };

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

async function requireSession(): Promise<void> {
  const ok = await getSession();
  if (!ok) throw new Error("Du är inte inloggad.");
}

export async function createManualActivityAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const parsed = activityEntrySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Kunde inte spara passet.",
    };
  }

  const startedAt = fromDatetimeLocal(
    parsed.data.startedAtLocal,
    parsed.data.timeZone,
  );
  const durationS =
    parsed.data.durationMinutes != null
      ? Math.round(parsed.data.durationMinutes * 60)
      : null;
  const distanceM =
    parsed.data.distance != null
      ? distanceToMeters(parsed.data.distance, parsed.data.distanceUnit)
      : null;
  const endedAt =
    durationS != null
      ? new Date(new Date(startedAt).getTime() + durationS * 1000).toISOString()
      : null;

  try {
    await requireSession();
    await sql`
      INSERT INTO activities (
        source, activity_type, started_at, ended_at, duration_s,
        distance_m, avg_pace_s_per_km, notes
      )
      VALUES (
        'manual',
        ${parsed.data.activityType},
        ${startedAt},
        ${endedAt},
        ${durationS},
        ${distanceM},
        ${derivedPace(distanceM, durationS)},
        ${parsed.data.notes || null}
      )
    `;
    revalidatePath("/overview");
    revalidatePath("/running");
    revalidatePath("/report");
    return { ok: true };
  } catch {
    return { error: "Kunde inte spara passet." };
  }
}

const notesSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().trim().max(2000),
});

export async function updateActivityNotesAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = notesSchema.safeParse({
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
