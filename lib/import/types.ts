export const ACTIVITY_TYPES = [
  "run",
  "trail_run",
  "treadmill",
  "walk",
  "hike",
  "cycle",
  "strength",
  "other",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ImportWarning = {
  code: string;
  message: string;
};

export type CanonicalActivity = {
  externalId: string | null;
  activityType: ActivityType;
  startedAt: string;
  endedAt: string | null;
  durationS: number | null;
  durationKind: "elapsed" | "moving" | "unknown" | null;
  distanceM: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  avgPaceSPerKm: number | null;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  avgCadence: number | null;
  caloriesKcal: number | null;
  trainingLoad: number | null;
  notes: string | null;
  laps: CanonicalLap[];
  trackpoints?: CanonicalTrackpoint[];
  samples?: CanonicalActivitySample[];
  providerPayload?: Record<string, unknown> | null;
};

export type CanonicalLap = {
  lapIndex: number;
  kind: "lap" | "split";
  startedAt: string | null;
  durationS: number | null;
  distanceM: number | null;
  avgPaceSPerKm: number | null;
  avgHeartRateBpm: number | null;
  elevationGainM: number | null;
  maxHeartRateBpm?: number | null;
  avgCadence?: number | null;
  elevationLossM?: number | null;
  caloriesKcal?: number | null;
};

export type CanonicalTrackpoint = {
  pointIndex: number;
  recordedAt: string;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  distanceM: number | null;
  heartRateBpm: number | null;
  cadence: number | null;
  speedMps: number | null;
  powerW: number | null;
  temperatureC: number | null;
};

export type CanonicalActivitySample = {
  sampleIndex: number;
  recordedAt: string;
  elapsedS: number | null;
  distanceM: number | null;
  heartRateBpm: number | null;
  cadence: number | null;
  speedMps: number | null;
  altitudeM: number | null;
  powerW: number | null;
  temperatureC: number | null;
};

export type CanonicalDailyHealth = {
  externalId: string | null;
  localDate: string;
  sleepDurationS: number | null;
  sleepStartAt: string | null;
  sleepEndAt: string | null;
  sleepLightS: number | null;
  sleepDeepS: number | null;
  sleepRemS: number | null;
  sleepAwakeS: number | null;
  hrvRmssdMs: number | null;
  restingHeartRateBpm: number | null;
  stressAvg: number | null;
  bodyBatteryHigh: number | null;
  bodyBatteryLow: number | null;
  steps: number | null;
  respirationAvgBrpm: number | null;
};

export type CanonicalBodyMeasurement = {
  externalId: string | null;
  measuredAt: string;
  massKg: number | null;
  bodyFatPct: number | null;
};

export type ParseResult = {
  activities: CanonicalActivity[];
  dailyHealth: CanonicalDailyHealth[];
  bodyMeasurements: CanonicalBodyMeasurement[];
  warnings: ImportWarning[];
};

export type ZipEntry = {
  path: string;
  bytes: Uint8Array;
};
