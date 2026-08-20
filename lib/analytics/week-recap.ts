import {
  addDays,
  isoWeekStart,
  isoWeekday,
  toLocalDate,
} from "@/lib/analytics/dates";
import { isRunFamily } from "@/lib/analytics/running-filter";
import { clamp01, mean } from "@/lib/analytics/stats";
import type { HealthPoint } from "@/lib/analytics/types";
import { DEFAULT_HYDRATION_TARGET_ML } from "@/lib/constants";

export const WEEK_RECAP_STEP_TARGET = 8_000;
export const WEEK_RECAP_EXPECTED_SESSIONS = 4;
export const WEEK_RECAP_HISTORY_WEEKS = 8;

export type RecapMedal = "gold" | "silver" | "bronze" | "none";
export type RecapDimensionKey =
  "sessions" | "distance" | "calories" | "water" | "sleep" | "steps";

export type RecapDimension = {
  key: RecapDimensionKey;
  label: string;
  score: number;
  detail: string;
};

export type RecapActivity = {
  startedAt: string;
  activityType: string;
  distanceM: number | null;
  caloriesKcal: number | null;
};

export type RecapFuelEntry = {
  at: string;
  amount: number;
};

export type RecapPlanDay = {
  localDate: string;
  kind: string;
};

export type WeekRange = {
  start: string;
  end: string;
};

export type WeekRecap = {
  weekStart: string;
  weekEnd: string;
  score: number;
  medal: RecapMedal;
  headline: string;
  summary: string;
  dimensions: RecapDimension[];
};

const DIMENSION_WEIGHT: Record<RecapDimensionKey, number> = {
  sessions: 1.25,
  distance: 1.15,
  calories: 1,
  water: 0.85,
  sleep: 0.85,
  steps: 0.6,
};

export function isMondayRecapDay(today: string): boolean {
  return isoWeekday(today) === 1;
}

/** The ISO week that ended most recently (Mon–Sun before the current week). */
export function lastCompletedWeek(today: string): WeekRange {
  const thisWeekStart = isoWeekStart(today);
  const start = addDays(thisWeekStart, -7);
  return { start, end: addDays(start, 6) };
}

export function completedWeeks(today: string, count: number): WeekRange[] {
  const latest = lastCompletedWeek(today);
  return Array.from({ length: count }, (_, index) => ({
    start: addDays(latest.start, -7 * index),
    end: addDays(latest.end, -7 * index),
  }));
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(10, Math.max(1, Math.round(value)));
}

export function scoreFromRatio(ratio: number): number {
  return clampScore(1 + 9 * clamp01(ratio));
}

export function medalForScore(score: number): RecapMedal {
  if (score >= 9) return "gold";
  if (score >= 7) return "silver";
  if (score >= 5) return "bronze";
  return "none";
}

export function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function calorieDayScore(logged: number, budget: number): number {
  if (logged <= 0) return 1;
  const ratio = logged / budget;
  if (ratio >= 0.85 && ratio <= 1.12) return 10;
  if (ratio >= 0.7 && ratio <= 1.25) return 8;
  if (ratio >= 0.55 && ratio <= 1.4) return 6;
  if (ratio >= 0.35) return 4;
  return 2;
}

function sleepHoursScore(hours: number): number {
  if (hours >= 7 && hours <= 8.5) return 10;
  if (hours >= 6.5 && hours <= 9) return 8;
  if (hours >= 6 && hours <= 9.5) return 6;
  if (hours >= 5) return 4;
  return 2;
}

function sumByDate(
  entries: RecapFuelEntry[],
  timeZone: string,
  dates: Set<string>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const localDate = toLocalDate(entry.at, timeZone);
    if (!dates.has(localDate)) continue;
    totals.set(localDate, (totals.get(localDate) ?? 0) + entry.amount);
  }
  return totals;
}

function headlineFor(score: number): string {
  if (score >= 9) return "Stark vecka.";
  if (score >= 7) return "Bra vecka.";
  if (score >= 5) return "Okej vecka.";
  return "Tuff vecka. Nästa blir en nystart.";
}

function summaryFor(score: number, dimensions: RecapDimension[]): string {
  const weak = [...dimensions]
    .sort((a, b) => a.score - b.score)
    .filter((dimension) => dimension.score <= 6)
    .slice(0, 2);
  if (score >= 9) {
    return "Pass, energi och återhämtning höll ihop.";
  }
  if (weak.length === 0) {
    return "Inga tydliga hål. Fortsätt som du gör.";
  }
  const names = weak.map((dimension) => dimension.label.toLowerCase());
  const joined = names.length === 1 ? names[0]! : `${names[0]} och ${names[1]}`;
  return `${joined} halkade efter.`;
}

export function buildWeekRecap(input: {
  weekStart: string;
  weekEnd: string;
  timeZone: string;
  activities: RecapActivity[];
  nutrition: RecapFuelEntry[];
  hydration: RecapFuelEntry[];
  health: HealthPoint[];
  planDays: RecapPlanDay[] | null;
  weeklyGoalM: number | null;
  dailyBudgetKcal: number | null;
  hydrationTargetMl?: number;
}): WeekRecap {
  const days = datesInRange(input.weekStart, input.weekEnd);
  const daySet = new Set(days);
  const dayCount = days.length;
  const waterTarget = input.hydrationTargetMl ?? DEFAULT_HYDRATION_TARGET_ML;

  const weekActivities = input.activities.filter((activity) =>
    daySet.has(toLocalDate(activity.startedAt, input.timeZone)),
  );
  const activityDates = new Set(
    weekActivities.map((activity) =>
      toLocalDate(activity.startedAt, input.timeZone),
    ),
  );
  const runDistanceM = weekActivities
    .filter((activity) => isRunFamily(activity.activityType))
    .reduce((sum, activity) => sum + (activity.distanceM ?? 0), 0);
  const activityKcalByDate = new Map<string, number>();
  for (const activity of weekActivities) {
    const localDate = toLocalDate(activity.startedAt, input.timeZone);
    activityKcalByDate.set(
      localDate,
      (activityKcalByDate.get(localDate) ?? 0) + (activity.caloriesKcal ?? 0),
    );
  }

  const nutritionByDate = sumByDate(input.nutrition, input.timeZone, daySet);
  const waterByDate = sumByDate(input.hydration, input.timeZone, daySet);
  const healthByDate = new Map(
    input.health
      .filter((row) => daySet.has(row.localDate))
      .map((row) => [row.localDate, row]),
  );

  const dimensions: RecapDimension[] = [];

  const plannedTrainingDays = (input.planDays ?? []).filter(
    (day) => daySet.has(day.localDate) && day.kind !== "rest",
  );
  if (plannedTrainingDays.length > 0) {
    const hits = plannedTrainingDays.filter((day) =>
      activityDates.has(day.localDate),
    ).length;
    dimensions.push({
      key: "sessions",
      label: "Pass",
      score: scoreFromRatio(hits / plannedTrainingDays.length),
      detail: `${hits} av ${plannedTrainingDays.length} planerade`,
    });
  } else {
    const expected = Math.max(
      1,
      Math.round((WEEK_RECAP_EXPECTED_SESSIONS * dayCount) / 7),
    );
    const count = weekActivities.length;
    dimensions.push({
      key: "sessions",
      label: "Pass",
      score: scoreFromRatio(count / expected),
      detail: `${count} av ${expected} pass`,
    });
  }

  if (input.weeklyGoalM != null && input.weeklyGoalM > 0) {
    const km = runDistanceM / 1000;
    const goalKm = input.weeklyGoalM / 1000;
    dimensions.push({
      key: "distance",
      label: "Distans",
      score: scoreFromRatio(runDistanceM / input.weeklyGoalM),
      detail: `${km.toLocaleString("sv-SE", {
        maximumFractionDigits: 1,
      })} av ${goalKm.toLocaleString("sv-SE", {
        maximumFractionDigits: 1,
      })} km`,
    });
  }

  const calorieScores = days.map((date) => {
    const logged = nutritionByDate.get(date) ?? 0;
    if (input.dailyBudgetKcal == null || input.dailyBudgetKcal <= 0) {
      return logged > 0 ? 7 : 1;
    }
    const budget = input.dailyBudgetKcal + (activityKcalByDate.get(date) ?? 0);
    return calorieDayScore(logged, budget);
  });
  const loggedFoodDays = days.filter(
    (date) => (nutritionByDate.get(date) ?? 0) > 0,
  ).length;
  dimensions.push({
    key: "calories",
    label: "Kalorier",
    score: clampScore(mean(calorieScores) ?? 1),
    detail: `${loggedFoodDays} av ${dayCount} dagar loggade`,
  });

  const waterScores = days.map((date) =>
    scoreFromRatio((waterByDate.get(date) ?? 0) / waterTarget),
  );
  const hitWaterDays = days.filter(
    (date) => (waterByDate.get(date) ?? 0) >= waterTarget,
  ).length;
  dimensions.push({
    key: "water",
    label: "Vatten",
    score: clampScore(mean(waterScores) ?? 1),
    detail: `${hitWaterDays} av ${dayCount} dagar mot målet`,
  });

  const sleepHours = days
    .map((date) => healthByDate.get(date)?.sleepDurationS)
    .filter((value): value is number => value != null && value > 0)
    .map((value) => value / 3600);
  if (sleepHours.length > 0) {
    const avg = mean(sleepHours) ?? 0;
    dimensions.push({
      key: "sleep",
      label: "Sömn",
      score: sleepHoursScore(avg),
      detail: `${avg.toLocaleString("sv-SE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} h i snitt`,
    });
  }

  const hasSteps = days.some(
    (date) => (healthByDate.get(date)?.steps ?? 0) > 0,
  );
  if (hasSteps) {
    const stepValues = days.map((date) => healthByDate.get(date)?.steps ?? 0);
    const avgSteps = mean(stepValues) ?? 0;
    dimensions.push({
      key: "steps",
      label: "Steg",
      score: scoreFromRatio(avgSteps / WEEK_RECAP_STEP_TARGET),
      detail: `${Math.round(avgSteps).toLocaleString("sv-SE")} / dag`,
    });
  }

  const weighted = dimensions.reduce(
    (sum, dimension) => sum + dimension.score * DIMENSION_WEIGHT[dimension.key],
    0,
  );
  const weightTotal = dimensions.reduce(
    (sum, dimension) => sum + DIMENSION_WEIGHT[dimension.key],
    0,
  );
  const score = clampScore(weighted / weightTotal);

  return {
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    score,
    medal: medalForScore(score),
    headline: headlineFor(score),
    summary: summaryFor(score, dimensions),
    dimensions,
  };
}
