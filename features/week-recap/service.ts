import { z } from "zod";

import { mapHealthRow } from "@/features/dashboard/map-rows";
import { dailyEnergyBalance } from "@/lib/analytics/daily-energy";
import { toLocalDate } from "@/lib/analytics/dates";
import {
  buildWeekRecap,
  completedWeeks,
  isMondayRecapDay,
  lastCompletedWeek,
  WEEK_RECAP_HISTORY_WEEKS,
  type RecapDimension,
  type RecapPlanDay,
  type WeekRecap,
} from "@/lib/analytics/week-recap";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import {
  insertWeekRecapIfMissing,
  listRecapSourceData,
  listWeekPlansByStarts,
  listWeekRecaps,
  upsertWeekRecap,
} from "@/lib/db/queries";
import { toFiniteNumber } from "@/lib/numbers";
import { weekPlanSchema } from "@/lib/training-plan/schema";

const dimensionSchema = z.object({
  key: z.enum(["sessions", "distance", "calories", "water", "sleep", "steps"]),
  label: z.string(),
  score: z.number().int().min(1).max(10),
  detail: z.string(),
});

const medalSchema = z.enum(["gold", "silver", "bronze", "none"]);

function mapStoredRecap(row: {
  week_start: string;
  week_end: string;
  score: number;
  medal: string;
  headline: string;
  summary: string;
  dimensions: unknown;
}): WeekRecap | null {
  const medal = medalSchema.safeParse(row.medal);
  const dimensions = z.array(dimensionSchema).safeParse(row.dimensions);
  const score = Number(row.score);
  if (!medal.success || !dimensions.success || !Number.isInteger(score)) {
    return null;
  }
  return {
    weekStart: row.week_start.slice(0, 10),
    weekEnd: row.week_end.slice(0, 10),
    score,
    medal: medal.data,
    headline: row.headline,
    summary: row.summary,
    dimensions: dimensions.data as RecapDimension[],
  };
}

function toTimestamp(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

export async function ensureWeekRecaps(now = new Date()): Promise<WeekRecap[]> {
  const lookback = new Date(now.getTime() - 70 * 86_400_000).toISOString();
  const source = await listRecapSourceData(lookback, lookback.slice(0, 10));
  const timeZone = source.timezone || DEFAULT_TIMEZONE;
  const today = toLocalDate(now.toISOString(), timeZone);
  const weeks = completedWeeks(today, WEEK_RECAP_HISTORY_WEEKS);
  const latestWeekStart = weeks[0]?.start;
  const monday = isMondayRecapDay(today);

  const stored = (await listWeekRecaps(WEEK_RECAP_HISTORY_WEEKS + 4))
    .map(mapStoredRecap)
    .filter((row): row is WeekRecap => row != null);
  const existingStarts = new Set(stored.map((row) => row.weekStart));
  const missing = weeks.filter(
    (week) =>
      !existingStarts.has(week.start) ||
      (monday && week.start === latestWeekStart),
  );

  if (missing.length > 0) {
    const energy = dailyEnergyBalance({
      massKg: toFiniteNumber(source.massKg),
      heightCm: toFiniteNumber(source.profile?.height_cm),
      birthDate: source.profile?.date_of_birth,
      sex: source.profile?.sex_at_birth ?? null,
      loggedKcal: 0,
      activityKcal: 0,
      now,
    });
    const planRows = await listWeekPlansByStarts(
      missing.map((week) => week.start),
    );
    const planByStart = new Map<string, RecapPlanDay[]>();
    for (const row of planRows) {
      const parsed = weekPlanSchema.safeParse(row.payload);
      if (parsed.success) {
        planByStart.set(
          row.local_date.slice(0, 10),
          parsed.data.days.map((day) => ({
            localDate: day.localDate,
            kind: day.kind,
          })),
        );
      }
    }

    const input = {
      timeZone,
      activities: source.activities.map((row) => ({
        startedAt: toTimestamp(row.started_at),
        activityType: row.activity_type,
        distanceM: toFiniteNumber(row.distance_m),
        caloriesKcal: toFiniteNumber(row.calories_kcal),
      })),
      nutrition: source.fuel.nutrition.map((row) => ({
        at: toTimestamp(row.eaten_at),
        amount: toFiniteNumber(row.energy_kcal) ?? 0,
      })),
      hydration: source.fuel.hydration.map((row) => ({
        at: toTimestamp(row.consumed_at),
        amount: toFiniteNumber(row.volume_ml) ?? 0,
      })),
      health: source.health.map(mapHealthRow),
      weeklyGoalM: toFiniteNumber(source.weeklyRunDistanceM),
      dailyBudgetKcal: energy?.maintenanceKcal ?? null,
    };

    for (const week of missing) {
      const recap = buildWeekRecap({
        weekStart: week.start,
        weekEnd: week.end,
        planDays: planByStart.get(week.start) ?? null,
        ...input,
      });
      if (monday && week.start === latestWeekStart) {
        await upsertWeekRecap(recap);
      } else {
        await insertWeekRecapIfMissing(recap);
      }
    }
  }

  return (await listWeekRecaps(WEEK_RECAP_HISTORY_WEEKS))
    .map(mapStoredRecap)
    .filter((row): row is WeekRecap => row != null);
}

export function mondayRecapFrom(
  recaps: WeekRecap[],
  today: string,
): WeekRecap | null {
  if (!isMondayRecapDay(today)) return null;
  const last = lastCompletedWeek(today);
  return recaps.find((recap) => recap.weekStart === last.start) ?? null;
}
