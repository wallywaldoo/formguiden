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

const CONNECT_API = "https://connectapi.garmin.com";
const DI_AUTH_URL = "https://diauth.garmin.com/di/oauth2/token";

export interface GarminSession {
  di_token: string;
  di_refresh_token: string;
  di_client_id: string;
}

export interface DailyStats {
  localDate: string;
  restingHeartRateBpm: number | null;
  stressAvg: number | null;
  bodyBatteryHigh: number | null;
  bodyBatteryLow: number | null;
  steps: number | null;
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
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
  if (typeof value === "string") {
    if (
      value.endsWith("Z") ||
      value.includes("+") ||
      value.endsWith("+00:00")
    ) {
      return new Date(value).toISOString();
    }
    return null;
  }
  if (typeof value === "number") {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  return null;
}

export class GarminClient {
  private session: GarminSession;
  /** Set to the refreshed session after the first call if a refresh happened */
  public refreshedSession: GarminSession | null = null;

  constructor(session: GarminSession) {
    this.session = session;
  }

  static fromEnv(): GarminClient {
    const raw = process.env.GARMIN_SESSION;
    if (!raw) {
      throw new Error("GARMIN_SESSION env var is not set");
    }
    let decoded = raw;
    // Support base64-encoded value
    if (!raw.trim().startsWith("{")) {
      decoded = Buffer.from(raw, "base64").toString("utf-8");
    }
    const session = JSON.parse(decoded) as GarminSession;
    return new GarminClient(session);
  }

  private async getToken(): Promise<string> {
    if (isTokenExpired(this.session.di_token)) {
      this.session = await refreshToken(this.session);
      this.refreshedSession = this.session;
    }
    return this.session.di_token;
  }

  private async fetch<T>(path: string): Promise<T> {
    const token = await this.getToken();
    const url = `${CONNECT_API}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "NK": "NT",
        "DI-Backend": "connectapi.garmin.com",
        "Accept": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Garmin API ${path} failed (${res.status}): ${text.slice(0, 300)}`,
      );
    }
    return res.json() as Promise<T>;
  }

  async getDailyStats(date: string): Promise<DailyStats> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetch<any>(
      `/usersummary-service/usersummary/daily/${date}?calendarDate=${date}`,
    );
    return {
      localDate: date,
      restingHeartRateBpm: data.restingHeartRate ?? null,
      stressAvg: data.averageStressLevel ?? null,
      bodyBatteryHigh: data.bodyBatteryHighestValue ?? null,
      bodyBatteryLow: data.bodyBatteryLowestValue ?? null,
      steps: data.totalSteps ?? null,
      respirationAvgBrpm: data.avgWakingRespirationValue ?? null,
    };
  }

  async getSleepData(date: string): Promise<SleepData> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetch<any>(
      `/wellness-service/wellness/dailySleepData/user?date=${date}&nonSleepBufferMinutes=60`,
    );
    const dto = data?.dailySleepDTO ?? {};
    return {
      localDate: date,
      sleepDurationS: dto.sleepTimeSeconds ?? null,
      sleepStartAt: utcFromGmt(dto.sleepStartTimestampGMT),
      sleepEndAt: utcFromGmt(dto.sleepEndTimestampGMT),
      sleepLightS: dto.lightSleepSeconds ?? null,
      sleepDeepS: dto.deepSleepSeconds ?? null,
      sleepRemS: dto.remSleepSeconds ?? null,
      sleepAwakeS: dto.awakeSleepSeconds ?? null,
      restingHeartRateBpm: dto.restingHeartRate ?? null,
    };
  }

  async getHrvData(date: string): Promise<HrvData> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetch<any>(`/hrv-service/hrv/${date}`);
    const summary = data?.hrvSummary ?? {};
    return {
      localDate: date,
      hrvRmssdMs: summary.lastNightAvg ?? null,
    };
  }

  async getWeightRange(
    startDate: string,
    endDate: string,
  ): Promise<WeightEntry[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetch<any>(
      `/weight-service/weight/dateRange?startDate=${startDate}&endDate=${endDate}`,
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
      activityType:
        a.activityType?.typeKey ?? a.activityType ?? "other",
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

  getRefreshedSession(): GarminSession | null {
    return this.refreshedSession;
  }
}
