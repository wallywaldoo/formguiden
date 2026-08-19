import { z } from "zod";

/**
 * Payload contract for the automation runner in scripts/garmin-sync.
 *
 * The runner reads Garmin Connect on the user's own machine and posts already
 * normalised values. That is the whole reason this path avoids the ambiguity
 * the GarminDB importer has to cope with: mass arrives in kilograms and every
 * instant arrives as UTC, because the source fields carry both.
 */
export const GARMIN_CONNECT_SCHEMA_VERSION = 1;

/** Bounds the work a single request can cause. Roughly a year of dailies. */
const MAX_DAILY_HEALTH = 400;
const MAX_BODY_MEASUREMENTS = 400;

const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum måste vara YYYY-MM-DD.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "Ogiltigt datum.",
  });

/**
 * Rejects naive timestamps rather than assuming a zone. Garmin exposes a GMT
 * field alongside every local one, so a missing offset means the runner read
 * the wrong field, and guessing would silently shift the record by hours.
 */
const utcInstant = z
  .string()
  .refine((value) => /(?:Z|[+-]\d{2}:?\d{2})$/.test(value), {
    message: "Tidsstämpeln måste ha UTC-offset.",
  })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Ogiltig tidsstämpel.",
  })
  .transform((value) => new Date(value).toISOString());

function optionalNumber(min: number, max: number) {
  return z.number().min(min).max(max).nullish().default(null);
}

function optionalSeconds(max: number) {
  return z.number().int().min(0).max(max).nullish().default(null);
}

const DAY_S = 24 * 60 * 60;

export const dailyHealthSchema = z.object({
  localDate,
  sleepDurationS: optionalSeconds(DAY_S),
  sleepStartAt: utcInstant.nullish().default(null),
  sleepEndAt: utcInstant.nullish().default(null),
  sleepLightS: optionalSeconds(DAY_S),
  sleepDeepS: optionalSeconds(DAY_S),
  sleepRemS: optionalSeconds(DAY_S),
  sleepAwakeS: optionalSeconds(DAY_S),
  hrvRmssdMs: optionalNumber(0, 500),
  restingHeartRateBpm: optionalNumber(20, 200),
  stressAvg: optionalNumber(0, 100),
  bodyBatteryHigh: optionalNumber(0, 100),
  bodyBatteryLow: optionalNumber(0, 100),
  steps: z.number().int().min(0).max(300000).nullish().default(null),
  respirationAvgBrpm: optionalNumber(0, 60),
});

export const bodyMeasurementSchema = z.object({
  measuredAt: utcInstant,
  massKg: optionalNumber(20, 400),
  bodyFatPct: optionalNumber(0, 100),
});

export const provenanceSchema = z.object({
  engine: z.literal("python-garminconnect"),
  engineVersion: z.string().min(1).max(32),
  scriptVersion: z.string().min(1).max(32),
});

export const garminConnectPayloadSchema = z.object({
  schemaVersion: z.literal(GARMIN_CONNECT_SCHEMA_VERSION),
  provenance: provenanceSchema,
  dailyHealth: z.array(dailyHealthSchema).max(MAX_DAILY_HEALTH).default([]),
  bodyMeasurements: z
    .array(bodyMeasurementSchema)
    .max(MAX_BODY_MEASUREMENTS)
    .default([]),
});

export type GarminConnectPayload = z.infer<typeof garminConnectPayloadSchema>;
export type GarminConnectProvenance = z.infer<typeof provenanceSchema>;
