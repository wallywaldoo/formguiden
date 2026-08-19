"use server";

import { revalidatePath } from "next/cache";

import {
  createNutritionEstimator,
  isNutritionAiEnabled,
} from "@/lib/ai/nutrition/create-estimator";
import { isOverAiRateLimit } from "@/lib/ai/nutrition/rate-limit";
import {
  AI_ESTIMATE_TIMEOUT_MS,
  NutritionAiDisabledError,
  NutritionAiRateLimitError,
  type NutritionEstimate,
} from "@/lib/ai/nutrition/types";
import { fromDatetimeLocal } from "@/lib/analytics/dates";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
import { nutritionProvenance } from "@/lib/nutrition/provenance";
import {
  idSchema,
  nutritionEntrySchema,
  nutritionEstimateSchema,
} from "@/lib/validation/logging";

export type LoggingActionState = {
  error?: string;
  ok?: boolean;
  estimate?: NutritionEstimate;
  requestId?: string;
  sample?: boolean;
};

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

async function requireSession(): Promise<void> {
  const ok = await getSession();
  if (!ok) throw new Error("Du är inte inloggad.");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("timeout"));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function createNutritionEntryAction(
  _prev: LoggingActionState,
  formData: FormData,
): Promise<LoggingActionState> {
  const parsed = nutritionEntrySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Kunde inte spara måltiden.",
    };
  }

  try {
    await requireSession();
    const eatenAt = fromDatetimeLocal(
      parsed.data.eatenAtLocal,
      parsed.data.timeZone,
    );
    const provenance = nutritionProvenance(
      parsed.data.aiEstimationRequestId,
      {
        energyKcal: parsed.data.energyKcal,
        proteinG: parsed.data.proteinG,
        carbohydrateG: parsed.data.carbohydrateG,
        fatG: parsed.data.fatG,
        fiberG: parsed.data.fiberG,
      },
      parsed.data.aiEstimationRequestId
        ? {
            energyKcal: parsed.data.estimatedEnergyKcal,
            proteinG: parsed.data.estimatedProteinG,
            carbohydrateG: parsed.data.estimatedCarbohydrateG,
            fatG: parsed.data.estimatedFatG,
            fiberG: parsed.data.estimatedFiberG,
          }
        : null,
    );
    await sql`
      INSERT INTO nutrition_entries
        (eaten_at, meal_type, description, energy_kcal, protein_g, carbohydrate_g, fat_g, fiber_g,
         provenance, ai_estimation_request_id, notes)
      VALUES (
        ${eatenAt}, ${parsed.data.mealType}, ${parsed.data.description},
        ${parsed.data.energyKcal}, ${parsed.data.proteinG}, ${parsed.data.carbohydrateG},
        ${parsed.data.fatG}, ${parsed.data.fiberG}, ${provenance},
        ${parsed.data.aiEstimationRequestId || null}, ${parsed.data.notes || null}
      )
    `;
    revalidatePath("/nutrition");
    revalidatePath("/overview");
    return { ok: true };
  } catch {
    return { error: "Kunde inte spara måltiden." };
  }
}

export async function deleteNutritionEntryAction(
  formData: FormData,
): Promise<LoggingActionState> {
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) {
    return { error: "Kunde inte ta bort måltiden." };
  }
  try {
    await requireSession();
    await sql`DELETE FROM nutrition_entries WHERE id = ${parsed.data}`;
    revalidatePath("/nutrition");
    revalidatePath("/overview");
    return {};
  } catch {
    return { error: "Kunde inte ta bort måltiden." };
  }
}

export async function estimateNutritionAction(
  _prev: LoggingActionState,
  formData: FormData,
): Promise<LoggingActionState> {
  const parsed = nutritionEstimateSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Beskriv maten först.",
    };
  }

  if (!isNutritionAiEnabled()) {
    return { error: new NutritionAiDisabledError().message };
  }

  try {
    await requireSession();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = await sql`
      SELECT created_at FROM ai_estimation_requests
      WHERE created_at >= ${since}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    if (isOverAiRateLimit(recent.map((row) => row.created_at as string))) {
      return { error: new NutritionAiRateLimitError().message };
    }

    const started = Date.now();
    const estimate = await withTimeout(
      createNutritionEstimator().estimate({
        description: parsed.data.description,
        locale: parsed.data.locale,
        massUnit: parsed.data.massUnit,
      }),
      AI_ESTIMATE_TIMEOUT_MS,
    );
    const inserted = await sql`
      INSERT INTO ai_estimation_requests
        (provider, model, status, prompt_description, locale,
         response_energy_kcal, response_protein_g, response_carbohydrate_g,
         response_fat_g, response_fiber_g, assumptions, confidence,
         range_energy_kcal_min, range_energy_kcal_max, error_code, duration_ms)
      VALUES (
        ${estimate.provider}, ${estimate.model ?? null}, 'succeeded',
        ${parsed.data.description}, ${parsed.data.locale},
        ${estimate.energyKcal}, ${estimate.proteinG}, ${estimate.carbohydrateG},
        ${estimate.fatG}, ${estimate.fiberG},
        ${estimate.assumptions.join("\n")}, ${estimate.confidence},
        ${estimate.energyKcalRange.min}, ${estimate.energyKcalRange.max},
        null, ${Date.now() - started}
      )
      RETURNING id
    `;
    return {
      estimate,
      requestId: inserted[0]!.id,
      sample: estimate.provider === "stub",
    };
  } catch (error) {
    if (error instanceof NutritionAiDisabledError) {
      return { error: error.message };
    }
    return { error: "Kunde inte uppskatta; fyll i manuellt." };
  }
}
