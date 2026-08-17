import { z } from "zod";

import { isDatetimeLocal } from "@/lib/analytics/dates";
import { isValidTimeZone } from "@/lib/validation/profile";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "other"] as const;
const BEVERAGE_TYPES = [
  "water",
  "coffee",
  "tea",
  "electrolyte",
  "other",
] as const;

function optionalNonNegative(max: number) {
  return z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value.trim() === "") {
        return null;
      }
      const parsed = Number.parseFloat(value.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine(
      (value) =>
        value === null ||
        (Number.isFinite(value) && value >= 0 && value <= max),
      { message: "Ange ett giltigt tal." },
    );
}

function optionalPositiveInt(max: number) {
  return z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value.trim() === "") {
        return null;
      }
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine(
      (value) =>
        value === null ||
        (Number.isInteger(value) && value > 0 && value <= max),
      { message: "Ange ett positivt heltal." },
    );
}

const timeZoneField = z
  .string()
  .min(1)
  .refine(isValidTimeZone, "Ogiltig tidszon.");

const datetimeLocalField = z
  .string()
  .refine(isDatetimeLocal, "Ange datum och tid.");

export const nutritionEntrySchema = z.object({
  timeZone: timeZoneField,
  eatenAtLocal: datetimeLocalField,
  mealType: z.enum(MEAL_TYPES),
  description: z.string().trim().min(1).max(2000),
  energyKcal: optionalNonNegative(20_000),
  proteinG: optionalNonNegative(1_000),
  carbohydrateG: optionalNonNegative(1_000),
  fatG: optionalNonNegative(1_000),
  fiberG: optionalNonNegative(200),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  aiEstimationRequestId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  estimatedEnergyKcal: optionalNonNegative(20_000),
  estimatedProteinG: optionalNonNegative(1_000),
  estimatedCarbohydrateG: optionalNonNegative(1_000),
  estimatedFatG: optionalNonNegative(1_000),
  estimatedFiberG: optionalNonNegative(200),
});

export const nutritionEstimateSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  locale: z.string().trim().min(2).max(16).default("sv-SE"),
  massUnit: z.enum(["kg", "lb"]).default("kg"),
});

export const hydrationEntrySchema = z.object({
  timeZone: timeZoneField,
  consumedAtLocal: datetimeLocalField,
  volume: z
    .string()
    .transform((value) => Number.parseFloat(value.replace(",", ".")))
    .refine((value) => Number.isFinite(value) && value > 0 && value <= 10_000, {
      message: "Ange en volym större än noll.",
    }),
  volumeUnit: z.enum(["ml", "floz"]),
  beverageType: z.enum(BEVERAGE_TYPES),
  caffeineMg: optionalNonNegative(2_000),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const weightEntrySchema = z.object({
  timeZone: timeZoneField,
  measuredAtLocal: datetimeLocalField,
  mass: z
    .string()
    .transform((value) => Number.parseFloat(value.replace(",", ".")))
    .refine((value) => Number.isFinite(value) && value > 0 && value <= 500, {
      message: "Ange en vikt större än noll.",
    }),
  massUnit: z.enum(["kg", "lb"]),
  bodyFatPct: optionalNonNegative(100),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const strengthSessionSchema = z.object({
  timeZone: timeZoneField,
  startedAtLocal: datetimeLocalField,
  durationMinutes: optionalPositiveInt(24 * 60),
  perceivedEffort: optionalNonNegative(10).refine(
    (value) => value === null || (value >= 1 && value <= 10),
    { message: "Ansträngning ska vara 1–10." },
  ),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const strengthSetSchema = z.object({
  sessionId: z.string().uuid(),
  exerciseName: z.string().trim().min(1).max(120),
  repetitions: optionalPositiveInt(500),
  mass: optionalNonNegative(1_000),
  massUnit: z.enum(["kg", "lb"]).default("kg"),
  rpe: optionalNonNegative(10).refine(
    (value) => value === null || (value >= 1 && value <= 10),
    { message: "RPE ska vara 1–10." },
  ),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const idSchema = z.string().uuid();
