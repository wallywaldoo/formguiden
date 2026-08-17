import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { LineMetricChart } from "@/features/dashboard/charts";
import { DataEmptyState } from "@/features/dashboard/data-empty-state";
import { mapHealthRow } from "@/features/dashboard/map-rows";
import { MetricCard } from "@/features/dashboard/metric-card";
import {
  hrvBaseline,
  rhrBaseline,
  sleepConsistency,
  sleepDurationMean,
  sleepSeries,
} from "@/lib/analytics/recovery";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { graphqlRequest } from "@/lib/graphql/client";
import { LIST_RECOVERY } from "@/lib/graphql/queries/dashboard";
import { toFiniteNumber } from "@/lib/numbers";
import { formatHours } from "@/lib/units/format";

export default async function RecoveryPage() {
  const now = new Date();
  const sinceDate = new Date(now.getTime() - 100 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let data: RecoveryPayload | null = null;
  try {
    data = await graphqlRequest<RecoveryPayload>(LIST_RECOVERY, {
      since_date: sinceDate,
    });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Återhämtning</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const context: AnalyticsContext = {
    timeZone: data.user_preferences[0]?.timezone || DEFAULT_TIMEZONE,
    now,
    goal: {
      weeklyRunDistanceM: null,
      targetPaceSPerKm: null,
      targetMassKg: null,
    },
  };
  const health = data.daily_health_metrics.map(mapHealthRow);
  const sleep = sleepDurationMean(health, context);
  const consistency = sleepConsistency(health, context);
  const hrv = hrvBaseline(health, context);
  const rhr = rhrBaseline(health, context);
  const chart = sleepSeries(health, context, 28).map((point) => ({
    date: point.date,
    hours: point.hours,
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Återhämtning</h1>
        <p className="text-muted-foreground">
          Sömn och HRV finns oftast i Garmin FIT-hälsoexport, inte i en vanlig
          aktivitetsfil.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Sömn"
          value={sleep.value != null ? formatHours(sleep.value) : "—"}
          caption="Medel 7 nätter med data"
          explanation="Medel sleep_duration_s / 7 möjliga nätter för täckning."
        />
        <MetricCard
          title="Sömnstart"
          value={
            consistency.value != null
              ? `${Math.round(consistency.value)} min stdavvikelse`
              : "—"
          }
          caption="Kräver minst 5 nätter med starttid"
          explanation="Stickprovsstandardavvikelse för sömnstart, räknat från klockan 18 för att hantera nattpassering."
        />
        <MetricCard
          title="HRV"
          value={hrv.value != null ? `${Math.round(hrv.value)} ms` : "—"}
          caption="Median 28 dagar"
          explanation="Kräver minst 14 mätningar av hrv_rmssd_ms."
        />
        <MetricCard
          title="Vilopuls"
          value={rhr.value != null ? `${Math.round(rhr.value)} bpm` : "—"}
          caption="Median 28 dagar"
          explanation="Kräver minst 14 mätningar av resting_heart_rate_bpm."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sömn 28 dagar</CardTitle>
          <CardDescription>
            Nätter utan data ritas inte som noll.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {health.every((point) => point.sleepDurationS == null) ? (
            <DataEmptyState
              title="Ingen sömn importerad"
              description="Ladda upp en FIT med sömn/wellness, inte bara ett enskilt löppass."
            />
          ) : (
            <LineMetricChart data={chart} dataKey="hours" label="timmar" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dagar</CardTitle>
        </CardHeader>
        <CardContent>
          {data.daily_health_metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga hälsodagar ännu.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Sömn</TableHead>
                  <TableHead>HRV</TableHead>
                  <TableHead>Vilopuls</TableHead>
                  <TableHead>Steg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.daily_health_metrics.map((day) => (
                  <TableRow key={day.id}>
                    <TableCell>{day.local_date}</TableCell>
                    <TableCell>
                      {day.sleep_duration_s != null
                        ? formatHours(day.sleep_duration_s)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {toFiniteNumber(day.hrv_rmssd_ms) != null
                        ? Math.round(toFiniteNumber(day.hrv_rmssd_ms)!)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {toFiniteNumber(day.resting_heart_rate_bpm) != null
                        ? Math.round(
                            toFiniteNumber(day.resting_heart_rate_bpm)!,
                          )
                        : "—"}
                    </TableCell>
                    <TableCell>{day.steps ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type RecoveryPayload = {
  user_preferences: Array<{ timezone: string }>;
  daily_health_metrics: Array<{
    id: string;
    local_date: string;
    sleep_duration_s: number | null;
    sleep_start_at: string | null;
    hrv_rmssd_ms: unknown;
    resting_heart_rate_bpm: unknown;
    steps: number | null;
    stress_avg: unknown;
    body_battery_high: unknown;
    body_battery_low: unknown;
  }>;
};
