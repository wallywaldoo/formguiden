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
import { graphqlRequest } from "@/lib/graphql/client";
import {
  DELETE_NUTRITION_ENTRY,
  INSERT_AI_ESTIMATION_REQUEST,
  INSERT_NUTRITION_ENTRY,
} from "@/lib/graphql/mutations/logging";
import { LIST_RECENT_AI_ESTIMATES } from "@/lib/graphql/queries/logging";
import { nutritionProvenance } from "@/lib/nutrition/provenance";
import { createNhostClient } from "@/lib/nhost/server";
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

async function requireUserId() {
  const nhost = await createNhostClient();
  const userId = nhost.getUserSession()?.user?.id;
  if (!userId) {
    throw new Error("Du är inte inloggad.");
  }
  return userId;
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
    await requireUserId();
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
    await graphqlRequest(INSERT_NUTRITION_ENTRY, {
      eaten_at: eatenAt,
      meal_type: parsed.data.mealType,
      description: parsed.data.description,
      energy_kcal: parsed.data.energyKcal,
      protein_g: parsed.data.proteinG,
      carbohydrate_g: parsed.data.carbohydrateG,
      fat_g: parsed.data.fatG,
      fiber_g: parsed.data.fiberG,
      provenance,
      ai_estimation_request_id: parsed.data.aiEstimationRequestId,
      notes: parsed.data.notes || null,
    });
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
    await requireUserId();
    await graphqlRequest(DELETE_NUTRITION_ENTRY, { id: parsed.data });
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
    await requireUserId();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = await graphqlRequest<{
      ai_estimation_requests: Array<{ created_at: string }>;
    }>(LIST_RECENT_AI_ESTIMATES, { since });
    if (
      isOverAiRateLimit(
        recent.ai_estimation_requests.map((row) => row.created_at),
      )
    ) {
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
    const inserted = await graphqlRequest<{
      insert_ai_estimation_requests_one: { id: string };
    }>(INSERT_AI_ESTIMATION_REQUEST, {
      provider: estimate.provider,
      model: estimate.model,
      status: "succeeded",
      prompt_description: parsed.data.description,
      locale: parsed.data.locale,
      response_energy_kcal: estimate.energyKcal,
      response_protein_g: estimate.proteinG,
      response_carbohydrate_g: estimate.carbohydrateG,
      response_fat_g: estimate.fatG,
      response_fiber_g: estimate.fiberG,
      assumptions: estimate.assumptions.join("\n"),
      confidence: estimate.confidence,
      range_energy_kcal_min: estimate.energyKcalRange.min,
      range_energy_kcal_max: estimate.energyKcalRange.max,
      error_code: null,
      duration_ms: Date.now() - started,
    });
    return {
      estimate,
      requestId: inserted.insert_ai_estimation_requests_one.id,
      sample: estimate.provider === "stub",
    };
  } catch (error) {
    if (error instanceof NutritionAiDisabledError) {
      return { error: error.message };
    }
    return { error: "Kunde inte uppskatta; fyll i manuellt." };
  }
}
