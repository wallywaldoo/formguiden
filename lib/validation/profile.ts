import { z } from "zod";

import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, RACE_TYPES } from "@/lib/constants";
import { parseDurationToSeconds } from "@/lib/units/pace";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export const distanceUnitSchema = z.enum(["km", "mi"]);
export const massUnitSchema = z.enum(["kg", "lb"]);
export const elevationUnitSchema = z.enum(["m", "ft"]);
export const volumeUnitSchema = z.enum(["ml", "floz"]);
export const temperatureUnitSchema = z.enum(["c", "f"]);

export const preferencesSchema = z.object({
  timezone: z.string().min(1).refine(isValidTimeZone, "Ogiltig tidszon."),
  locale: z.literal(DEFAULT_LOCALE).or(z.literal("en-US")),
  distanceUnit: distanceUnitSchema,
  massUnit: massUnitSchema,
  elevationUnit: elevationUnitSchema,
  volumeUnit: volumeUnitSchema,
  temperatureUnit: temperatureUnitSchema,
});

const optionalPositiveNumber = z
  .string()
  .optional()
  .transform((value) => {
    if (!value || value.trim() === "") {
      return null;
    }
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  })
  .refine((value) => value === null || (value > 0 && Number.isFinite(value)), {
    message: "Ange ett positivt tal.",
  });

export const profileSchema = z.object({
  displayName: z.string().trim().max(32).optional().or(z.literal("")),
  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Ange datum som ÅÅÅÅ-MM-DD.",
    ),
  sexAtBirth: z.enum(["female", "male", "unspecified", ""]).optional(),
  heightCm: optionalPositiveNumber,
});

const optionalPositiveInt = z
  .string()
  .optional()
  .transform((value) => {
    if (!value || value.trim() === "") {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  })
  .refine((value) => value === null || (Number.isInteger(value) && value > 0), {
    message: "Ange ett positivt heltal.",
  });

export const goalInputSchema = z
  .object({
    raceType: z.enum(RACE_TYPES),
    customDistanceKm: z.string().optional(),
    raceDate: z.string().optional(),
    targetDuration: z.string().optional(),
    targetPaceOverride: z.string().optional(),
    targetMassKg: optionalPositiveNumber,
    weeklyRunDistanceKm: optionalPositiveNumber,
    weeklyRunDuration: z.string().optional(),
    weeklyStrengthSessions: optionalPositiveInt,
    weeklyStrengthDuration: z.string().optional(),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.raceType === "custom") {
      const km = Number.parseFloat(
        (value.customDistanceKm ?? "").replace(",", "."),
      );
      if (!Number.isFinite(km) || km <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Ange en distans i kilometer.",
          path: ["customDistanceKm"],
        });
      }
    }
    if (
      value.targetDuration &&
      parseDurationToSeconds(value.targetDuration) == null
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Använd formatet TT:MM:SS eller MM:SS.",
        path: ["targetDuration"],
      });
    }
    if (
      value.weeklyRunDuration &&
      parseDurationToSeconds(value.weeklyRunDuration) == null
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Använd formatet TT:MM:SS eller MM:SS.",
        path: ["weeklyRunDuration"],
      });
    }
    if (
      value.weeklyStrengthDuration &&
      parseDurationToSeconds(value.weeklyStrengthDuration) == null
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Använd formatet TT:MM:SS eller MM:SS.",
        path: ["weeklyStrengthDuration"],
      });
    }
  });

export const onboardingSchema = z.object({
  privacyAccepted: z.boolean().refine((value) => value === true, {
    message: "Du måste godkänna integritetsvillkoren för att fortsätta.",
  }),
  displayName: z.string().trim().max(32).optional().or(z.literal("")),
  timezone: z
    .string()
    .min(1)
    .refine(isValidTimeZone, "Ogiltig tidszon.")
    .default(DEFAULT_TIMEZONE),
  distanceUnit: distanceUnitSchema.default("km"),
  massUnit: massUnitSchema.default("kg"),
  elevationUnit: elevationUnitSchema.default("m"),
  volumeUnit: volumeUnitSchema.default("ml"),
  temperatureUnit: temperatureUnitSchema.default("c"),
  raceType: z.enum(RACE_TYPES).default("half_marathon"),
  customDistanceKm: z.string().optional(),
  raceDate: z.string().optional(),
  targetDuration: z.string().optional(),
  targetMassKg: optionalPositiveNumber,
  weeklyRunDistanceKm: optionalPositiveNumber,
  weeklyRunDuration: z.string().optional(),
  weeklyStrengthSessions: optionalPositiveInt,
  weeklyStrengthDuration: z.string().optional(),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type GoalInput = z.input<typeof goalInputSchema>;
