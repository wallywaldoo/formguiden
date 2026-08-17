export const RUN_FAMILY = ["run", "trail_run", "treadmill"] as const;

export type RunFamilyType = (typeof RUN_FAMILY)[number];

export type ActivityPoint = {
  id: string;
  activityType: string;
  startedAt: string;
  distanceM: number | null;
  durationS: number | null;
  avgPaceSPerKm: number | null;
  avgHeartRateBpm: number | null;
};

export type HealthPoint = {
  localDate: string;
  sleepDurationS: number | null;
  sleepStartAt: string | null;
  hrvRmssdMs: number | null;
  restingHeartRateBpm: number | null;
  steps: number | null;
  stressAvg: number | null;
  bodyBatteryHigh: number | null;
  bodyBatteryLow: number | null;
};

export type BodyPoint = {
  measuredAt: string;
  massKg: number | null;
  bodyFatPct: number | null;
};

export type MetricResult<T> = {
  value: T | null;
  completeness: number;
  explanationKey: string;
};

export type AnalyticsGoal = {
  weeklyRunDistanceM: number | null;
  targetPaceSPerKm: number | null;
  targetMassKg: number | null;
};

export type AnalyticsContext = {
  timeZone: string;
  now: Date;
  goal: AnalyticsGoal;
};

export const LONG_RUN_WEEKLY_FRACTION = 0.3;
export const HRV_BASELINE_DAYS = 28;
export const HRV_MIN_POINTS = 14;
export const RHR_BASELINE_DAYS = 28;
export const RHR_MIN_POINTS = 14;
export const SLEEP_MEAN_DAYS = 7;
export const SLEEP_CONSISTENCY_MIN_NIGHTS = 5;
export const BODY_TREND_DAYS = 28;
export const BODY_TREND_MIN_POINTS = 4;
export const PACE_EASY_FACTOR = 1.1;
export const PACE_FAST_FACTOR = 0.95;
export const REPRESENTATIVE_MIN_DISTANCE_M = 5_000;
