/**
 * Garmin Connect TypeScript client.
 *
 * Authentication strategy:
 *   Garmin uses a "DI" (Direct Integration) OAuth 2 token pair stored by the
 *   python-garminconnect library at ~/.garminconnect/garmin_tokens.json.
 *   The file contains { di_token, di_refresh_token, di_client_id }.
 *
 *   For Vercel we store this JSON as the GARMIN_SESSION env var (base64 or raw).
 *   On each request we:
 *     1. Check if di_token is still valid (exp claim).
 *     2. If expired, refresh it via the Garmin DI token endpoint.
 *     3. Return the refreshed session so callers can persist it back to Vercel
 *        (or just use it for this invocation — tokens last ~20 h).
 *
 *   The Garmin Connect API base URL is https://connectapi.garmin.com — this is
 *   the same host the python library resolves to. All data endpoints require
 *   the DI Bearer token in the Authorization header.
 *
 * NOTE: If Garmin changes their auth scheme this stub remains the integration
 * point. Replace tokenRefresh() and the Authorization header logic; the rest
 * of the class stays the same.
 */

import {
  parseGarminPersonalRecords,
  type GarminRunningRecords,
} from "@/lib/garmin/personal-records";
import {
  GARMIN_SESSION_INVALID_MESSAGE,
  type GarminSession,
} from "@/lib/garmin/session";
import {
  loadGarminSession,
  persistGarminSession,
} from "@/lib/garmin/session-file";
import { unzipSync } from "fflate";

const CONNECT_API = "https://connectapi.garmin.com";
export const DI_AUTH_URL =
  "https://diauth.garmin.com/di-oauth2-service/oauth/token";

export type { GarminSession };

export interface DailyStats {
  localDate: string;
  restingHeartRateBpm: number | null;
  stressAvg: number | null;
  bodyBatteryHigh: number | null;
  bodyBatteryLow: number | null;
  steps: number | null;
  sleepDurationS: number | null;
  respirationAvgBrpm: number | null;
}

export interface SleepData {
  localDate: string;
  sleepDurationS: number | null;
  sleepStartAt: string | null;
  sleepEndAt: string | null;
  sleepLightS: number | null;
  sleepDeepS: number | null;
  sleepRemS: number | null;
  sleepAwakeS: number | null;
  restingHeartRateBpm: number | null;
}

export interface HrvData {
  localDate: string;
  hrvRmssdMs: number | null;
}

export interface TrainingStatus {
  label: string | null;
  feedbackPhrase: string | null;
}

export interface FitnessAge {
  fitnessAge: number | null;
  chronologicalAge: number | null;
}

export interface WeightEntry {
  measuredAt: string;
  massKg: number | null;
  bodyFatPct: number | null;
}

export interface GarminActivity {
  activityId: string;
  activityName: string;
  activityType: string;
  startTimeGMT: string;
  duration: number;
  distance: number | null;
  averageHR: number | null;
  maxHR: number | null;
  elevationGain: number | null;
  calories: number | null;
  averageSpeed: number | null;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
  } catch {
    return {};
  }
}

function isTokenExpired(token: string, bufferSeconds = 300): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload.exp as number | undefined;
  if (!exp) return true;
  return Date.now() / 1000 + bufferSeconds > exp;
}

async function refreshToken(session: GarminSession): Promise<GarminSession> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.di_refresh_token,
    client_id: session.di_client_id,
  });

  const res = await fetch(DI_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${session.di_client_id}:`).toString("base64")}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Garmin token refresh failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  return {
    di_token: json.access_token ?? session.di_token,
    di_refresh_token: json.refresh_token ?? session.di_refresh_token,
    di_client_id: session.di_client_id,
  };
}

function utcFromGmt(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return utcFromGmt(Number(trimmed));
    const withZone = /Z|[+-]\d{2}:\d{2}$/.test(trimmed)
      ? trimmed
      : `${trimmed}Z`;
    const date = new Date(withZone);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function num(
  data: Record<string, unknown> | null,
  ...keys: string[]
): number | null {
  if (!data) return null;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function extractVo2Max(payload: unknown): number | null {
  const pick = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) && value > 0
      ? Math.round(value * 10) / 10
      : null;

  const fromRecord = (row: Record<string, unknown> | null): number | null => {
    if (!row) return null;
    const nested =
      row.generic &&
      typeof row.generic === "object" &&
      !Array.isArray(row.generic)
        ? (row.generic as Record<string, unknown>)
        : null;
    const candidates = [
      nested?.vo2MaxPreciseValue,
      nested?.vo2MaxValue,
      row.vo2MaxPreciseValue,
      row.vo2MaxValue,
      row.genericVO2Max,
      row.vo2Max,
      row.vo2_max_precise,
      row.vo2_max,
    ];
    for (const value of candidates) {
      const parsed = pick(value);
      if (parsed != null) return parsed;
    }
    return null;
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const parsed = fromRecord(item as Record<string, unknown>);
        if (parsed != null) return parsed;
      }
    }
    return null;
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const row = payload as Record<string, unknown>;
    const direct = fromRecord(row);
    if (direct != null) return direct;
    const mostRecent =
      row.mostRecentVO2Max &&
      typeof row.mostRecentVO2Max === "object" &&
      !Array.isArray(row.mostRecentVO2Max)
        ? (row.mostRecentVO2Max as Record<string, unknown>)
        : null;
    return fromRecord(mostRecent);
  }

  return null;
}

function localDateOffset(days: number, from = new Date()): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function extractFitnessAge(payload: unknown): FitnessAge | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const row = payload as Record<string, unknown>;
  const asAge = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) && value > 0
      ? Math.round(value)
      : null;

  const fitnessAge = asAge(
    row.fitnessAge ?? row.fitness_age ?? row.fitnessAgeYears,
  );
  const chronologicalAge = asAge(
    row.chronologicalAge ??
      row.chronological_age ??
      row.chronological_age_years ??
      row.chronologicalAgeYears,
  );
  if (fitnessAge == null && chronologicalAge == null) {
    return null;
  }
  return { fitnessAge, chronologicalAge };
}

function trainingStatusLabel(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const key = value.replace(/_\d+$/, "");
  switch (key) {
    case "PEAKING":
      return "Toppning";
    case "PRODUCTIVE":
      return "Produktiv";
    case "MAINTAINING":
      return "Bibehåller";
    case "RECOVERY":
      return "Återhämtning";
    case "UNPRODUCTIVE":
      return "Oproduktiv";
    case "OVERREACHING":
      return "Overreaching";
    case "DETRAINING":
      return "Nedträning";
    case "STRAINED":
      return "Ansträngd";
    case "NO_STATUS":
      return "Ingen status";
    default:
      return null;
  }
}

export class GarminClient {
  private session: GarminSession;
  private displayName: string | null = null;
  /** Set to the refreshed session after the first call if a refresh happened */
  public refreshedSession: GarminSession | null = null;

  constructor(session: GarminSession) {
    this.session = session;
  }

  static fromEnv(): GarminClient {
    const session = loadGarminSession();
    if (!session) {
      throw new Error(
        process.env.GARMIN_SESSION?.trim()
          ? GARMIN_SESSION_INVALID_MESSAGE
          : "GARMIN_SESSION env var is not set",
      );
    }
    return new GarminClient(session);
  }

  private async getToken(): Promise<string> {
    if (isTokenExpired(this.session.di_token)) {
      this.session = await refreshToken(this.session);
      this.refreshedSession = this.session;
      persistGarminSession(this.session);
    }
    return this.session.di_token;
  }

  private async fetch<T>(path: string): Promise<T> {
    const token = await this.getToken();
    const url = `${CONNECT_API}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        NK: "NT",
        "DI-Backend": "connectapi.garmin.com",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Garmin API ${path} failed (${res.status}): ${text.slice(0, 300)}`,
      );
    }

    if (res.status === 204) {
      return null as T;
    }

    const text = await res.text();
    if (!text.trim() || text.trim() === "null") {
      return null as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(
        `Garmin API ${path} returned invalid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async fetchBytes(path: string): Promise<Uint8Array> {
    const token = await this.getToken();
    const url = `${CONNECT_API}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        NK: "NT",
        "DI-Backend": "connectapi.garmin.com",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Garmin API ${path} failed (${res.status}): ${text.slice(0, 300)}`,
      );
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  private async fetchOptional<T>(path: string): Promise<T | null> {
    try {
      return await this.fetch<T>(path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("(404)") ||
        message.includes("(204)") ||
        message.includes("(500)")
      ) {
        return null;
      }
      throw error;
    }
  }

  private async getDisplayName(): Promise<string> {
    if (this.displayName) return this.displayName;

    const profile = await this.fetch<{ displayName?: unknown }>(
      "/userprofile-service/socialProfile",
    );
    const displayName =
      typeof profile?.displayName === "string"
        ? profile.displayName.trim()
        : "";

    if (!displayName) {
      throw new Error("Garmin social profile did not include a displayName");
    }

    this.displayName = encodeURIComponent(displayName);
    return this.displayName;
  }

  async getDailyStats(date: string): Promise<DailyStats> {
    const displayName = await this.getDisplayName();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data =
      (await this.fetch<Record<string, unknown>>(
        `/usersummary-service/usersummary/daily/${displayName}?calendarDate=${date}`,
      )) ?? {};
    return {
      localDate: date,
      restingHeartRateBpm: num(data, "restingHeartRate", "resting_heart_rate"),
      stressAvg: num(data, "averageStressLevel", "avg_stress_level"),
      bodyBatteryHigh: num(
        data,
        "bodyBatteryHighestValue",
        "body_battery_highest",
      ),
      bodyBatteryLow: num(
        data,
        "bodyBatteryLowestValue",
        "body_battery_lowest",
      ),
      steps: num(data, "totalSteps", "steps", "total_steps"),
      sleepDurationS: num(
        data,
        "sleepingSeconds",
        "sleeping_seconds",
        "sleepTimeSeconds",
      ),
      respirationAvgBrpm: num(
        data,
        "avgWakingRespirationValue",
        "avg_waking_respiration",
      ),
    };
  }

  async getSleepData(date: string): Promise<SleepData> {
    const displayName = await this.getDisplayName();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetch<any>(
      `/wellness-service/wellness/dailySleepData/${displayName}?date=${date}&nonSleepBufferMinutes=60`,
    );
    const dto = (data?.dailySleepDTO ?? {}) as Record<string, unknown>;
    return {
      localDate: date,
      sleepDurationS: num(dto, "sleepTimeSeconds", "sleep_seconds"),
      sleepStartAt: utcFromGmt(
        dto.sleepStartTimestampGMT ?? dto.sleepStartTimestampLocal,
      ),
      sleepEndAt: utcFromGmt(
        dto.sleepEndTimestampGMT ?? dto.sleepEndTimestampLocal,
      ),
      sleepLightS: num(dto, "lightSleepSeconds"),
      sleepDeepS: num(dto, "deepSleepSeconds"),
      sleepRemS: num(dto, "remSleepSeconds"),
      sleepAwakeS: num(dto, "awakeSleepSeconds"),
      restingHeartRateBpm: num(dto, "restingHeartRate"),
    };
  }

  async getHrvData(date: string): Promise<HrvData> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetchOptional<any>(`/hrv-service/hrv/${date}`);
    const summary =
      data?.hrvSummary && typeof data.hrvSummary === "object"
        ? (data.hrvSummary as Record<string, unknown>)
        : ((data ?? {}) as Record<string, unknown>);
    return {
      localDate: date,
      hrvRmssdMs: num(
        summary,
        "lastNightAvg",
        "lastNight5MinHigh",
        "weeklyAvg",
        "hrvValue",
      ),
    };
  }

  async getWeightRange(
    startDate: string,
    endDate: string,
  ): Promise<WeightEntry[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetch<any>(
      `/weight-service/weight/range/${startDate}/${endDate}?includeAll=true`,
    );
    const entries: WeightEntry[] = [];
    for (const day of data?.dailyWeightSummaries ?? []) {
      for (const metric of day?.allWeightMetrics ?? []) {
        const measuredAt = utcFromGmt(metric.timestampGMT);
        if (!measuredAt) continue;
        entries.push({
          measuredAt,
          massKg:
            metric.weight != null ? Math.round(metric.weight / 10) / 100 : null,
          bodyFatPct: metric.bodyFat ?? null,
        });
      }
    }
    return entries;
  }

  async getActivities(
    startDate: string,
    endDate: string,
    limit = 100,
  ): Promise<GarminActivity[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetch<any[]>(
      `/activitylist-service/activities/search/activities?startDate=${startDate}&endDate=${endDate}&limit=${limit}`,
    );
    if (!Array.isArray(data)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((a: any) => ({
      activityId: String(a.activityId ?? a.id ?? ""),
      activityName: a.activityName ?? a.title ?? "",
      activityType: a.activityType?.typeKey ?? a.activityType ?? "other",
      startTimeGMT: a.startTimeGMT ?? a.startTimeLocal ?? "",
      duration: a.duration ?? a.elapsedDuration ?? 0,
      distance: a.distance ?? null,
      averageHR: a.averageHR ?? null,
      maxHR: a.maxHR ?? null,
      elevationGain: a.elevationGain ?? null,
      calories: a.calories ?? null,
      averageSpeed: a.averageSpeed ?? null,
    }));
  }

  async getActivitySummary(activityId: string): Promise<unknown> {
    return this.fetch(`/activity-service/activity/${activityId}`);
  }

  async getActivityDetails(
    activityId: string,
    options?: { maxChartSize?: number; maxPolylineSize?: number },
  ): Promise<unknown> {
    const maxChartSize = options?.maxChartSize ?? 2000;
    const maxPolylineSize = options?.maxPolylineSize ?? 4000;
    return this.fetch(
      `/activity-service/activity/${activityId}/details?maxChartSize=${maxChartSize}&maxPolylineSize=${maxPolylineSize}`,
    );
  }

  async getActivitySplits(activityId: string): Promise<unknown> {
    return this.fetchOptional(
      `/activity-service/activity/${activityId}/splits`,
    );
  }

  async getActivityHrZones(activityId: string): Promise<unknown> {
    return this.fetchOptional(
      `/activity-service/activity/${activityId}/hrTimeInZones`,
    );
  }

  async getActivityWeather(activityId: string): Promise<unknown> {
    return this.fetchOptional(
      `/activity-service/activity/${activityId}/weather`,
    );
  }

  async getRacePredictionsOptional(): Promise<{
    calendarDate: string | null;
    time5K: number | null;
    time10K: number | null;
    timeHalfMarathon: number | null;
    timeMarathon: number | null;
  } | null> {
    const displayName = await this.getDisplayName();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetchOptional<any>(
      `/metrics-service/metrics/racepredictions/latest/${displayName}`,
    );
    if (!data) return null;
    const pick = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : null;
    return {
      calendarDate:
        typeof data.calendarDate === "string" ? data.calendarDate : null,
      time5K: pick(data.time5K),
      time10K: pick(data.time10K),
      timeHalfMarathon: pick(data.timeHalfMarathon),
      timeMarathon: pick(data.timeMarathon),
    };
  }

  async getPersonalRecordsOptional(): Promise<GarminRunningRecords | null> {
    const displayName = await this.getDisplayName();
    const data = await this.fetchOptional<unknown>(
      `/personalrecord-service/personalrecord/prs/${displayName}`,
    );
    return parseGarminPersonalRecords(data);
  }

  async getVo2MaxOptional(): Promise<number | null> {
    // python-garminconnect uses maxmet/daily/{date}/{date} and nests values
    // under `generic`. VO₂ often only exists on days with an activity, so we
    // walk a short lookback, then fall back to training status.
    for (let offset = 0; offset <= 21; offset += 1) {
      const date = localDateOffset(-offset);
      const daily = await this.fetchOptional<unknown>(
        `/metrics-service/metrics/maxmet/daily/${date}/${date}`,
      );
      const fromDaily = extractVo2Max(daily);
      if (fromDaily != null) return fromDaily;
    }

    const today = localDateOffset(0);
    const trainingStatus = await this.fetchOptional<unknown>(
      `/metrics-service/metrics/trainingstatus/aggregated/${today}`,
    );
    return extractVo2Max(trainingStatus);
  }

  async getTrainingStatusOptional(): Promise<TrainingStatus | null> {
    const today = localDateOffset(0);
    const data = await this.fetchOptional<unknown>(
      `/metrics-service/metrics/trainingstatus/aggregated/${today}`,
    );
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    const root = data as Record<string, unknown>;
    const recent =
      root.mostRecentTrainingStatus &&
      typeof root.mostRecentTrainingStatus === "object" &&
      !Array.isArray(root.mostRecentTrainingStatus)
        ? (root.mostRecentTrainingStatus as Record<string, unknown>)
        : null;
    const latestMap =
      recent?.latestTrainingStatusData &&
      typeof recent.latestTrainingStatusData === "object" &&
      !Array.isArray(recent.latestTrainingStatusData)
        ? (recent.latestTrainingStatusData as Record<string, unknown>)
        : null;

    const entries = latestMap
      ? Object.values(latestMap).filter(
          (entry): entry is Record<string, unknown> =>
            !!entry && typeof entry === "object" && !Array.isArray(entry),
        )
      : [];
    const best =
      entries.find((entry) => entry.primaryTrainingDevice === true) ??
      entries[0];
    if (!best) {
      return null;
    }

    const feedbackPhrase =
      typeof best.trainingStatusFeedbackPhrase === "string"
        ? best.trainingStatusFeedbackPhrase
        : null;
    return {
      label: trainingStatusLabel(feedbackPhrase),
      feedbackPhrase,
    };
  }

  async getFitnessAgeOptional(): Promise<FitnessAge | null> {
    for (let offset = 0; offset <= 14; offset += 1) {
      const date = localDateOffset(-offset);
      const data = await this.fetchOptional<unknown>(
        `/fitnessage-service/fitnessage/${date}`,
      );
      const parsed = extractFitnessAge(data);
      if (parsed?.fitnessAge != null || parsed?.chronologicalAge != null) {
        return parsed;
      }
    }
    return null;
  }

  async downloadActivityFit(activityId: string): Promise<Uint8Array | null> {
    try {
      const zipBytes = await this.fetchBytes(
        `/download-service/files/activity/${activityId}`,
      );
      const files = unzipSync(zipBytes);
      const fitEntry = Object.entries(files).find(([name]) =>
        name.toLowerCase().endsWith(".fit"),
      );
      if (!fitEntry) {
        return null;
      }
      return fitEntry[1];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("(404)") || message.includes("(500)")) {
        return null;
      }
      throw error;
    }
  }

  getRefreshedSession(): GarminSession | null {
    return this.refreshedSession;
  }
}
