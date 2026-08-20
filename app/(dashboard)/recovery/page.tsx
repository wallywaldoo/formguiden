import { CollapsiblePanel } from "@/components/dashboard/collapsible-panel";
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
  BodyBatteryChart,
  HrvTrendChart,
  StepsChart,
  StressChart,
} from "@/features/dashboard/recovery-charts";
import {
  bodyBatterySeries,
  hrvBaseline,
  hrvSeries,
  rhrBaseline,
  sleepConsistency,
  sleepDurationMean,
  sleepSeries,
  stepsSeries,
  stressSeries,
} from "@/lib/analytics/recovery";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { listRecovery } from "@/lib/db/queries";
import { toIsoDate } from "@/lib/analytics/daily-energy";
import { toFiniteNumber } from "@/lib/numbers";
import { formatHours } from "@/lib/units/format";
import { cn } from "@/lib/utils";

function sleepToneClass(seconds: number | null): string | undefined {
  if (seconds == null || seconds <= 0) return undefined;
  const hours = seconds / 3600;
  if (hours > 7) return "bg-emerald-500/15 text-emerald-800";
  if (hours >= 6) return "bg-amber-500/15 text-amber-900";
  return "bg-rose-500/15 text-rose-800";
}

function hrvToneClass(
  value: number | null,
  baseline: number | null,
): string | undefined {
  if (value == null || baseline == null || baseline <= 0) return undefined;
  const ratio = value / baseline;
  if (ratio >= 0.95) return "bg-emerald-500/15 text-emerald-800";
  if (ratio >= 0.85) return "bg-amber-500/15 text-amber-900";
  return "bg-rose-500/15 text-rose-800";
}

export default async function RecoveryPage() {
  const now = new Date();
  const sinceDate = new Date(now.getTime() - 100 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let data: RecoveryPayload | null = null;
  try {
    data = await listRecovery(sinceDate);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Återhämtning</h1>
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
  const sleepChart = sleepSeries(health, context, 28).map((point) => ({
    date: point.date,
    hours: point.hours,
  }));
  const batteryChart = bodyBatterySeries(health, context, 28);
  const stressChart = stressSeries(health, context, 28);
  const hrvChart = hrvSeries(health, context, 28);
  const stepsChart = stepsSeries(health, context, 7);
  const hasSleep = health.some((point) => point.sleepDurationS != null);
  const stepsGoal = null;

  return (
    <div className="space-y-8">
      <h1 className="page-title">Återhämtning</h1>

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
          title="HRV (medel)"
          value={hrv.value != null ? `${Math.round(hrv.value)} ms` : "—"}
          caption="Median över 28 dagar"
          explanation="Median av hrv_rmssd_ms under 28 dagar. Kräver minst 14 mätningar."
        />
        <MetricCard
          title="Vilopuls"
          value={rhr.value != null ? `${Math.round(rhr.value)} bpm` : "—"}
          caption="Median 28 dagar"
          explanation="Kräver minst 14 mätningar av resting_heart_rate_bpm."
        />
      </div>

      <CollapsiblePanel
        storageKey="fk:collapse:recovery-sleep"
        title="Sömn 28 dagar"
        bodyClassName="space-y-3 px-5 py-4"
      >
        <p className="text-sm text-muted-foreground">
          Nätter utan data ritas inte som noll.
        </p>
        {!hasSleep ? (
          <DataEmptyState
            title="Ingen sömn importerad"
            description="Ladda upp en FIT med sömn/wellness, inte bara ett enskilt löppass."
          />
        ) : (
          <LineMetricChart data={sleepChart} dataKey="hours" label="timmar" />
        )}
      </CollapsiblePanel>

      {batteryChart.length > 0 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:recovery-body-battery"
          title="Body Battery"
          bodyClassName="space-y-3 px-5 py-4"
        >
          <p className="text-sm text-muted-foreground">
            Högsta och lägsta Body Battery per dag under 28 dagar.
          </p>
          <BodyBatteryChart data={batteryChart} />
        </CollapsiblePanel>
      ) : null}

      {stressChart.length > 0 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:recovery-stress"
          title="Stress"
          bodyClassName="space-y-3 px-5 py-4"
        >
          <p className="text-sm text-muted-foreground">
            Medelstress per dag. Grönt är lågt, gult medel, rött högt.
          </p>
          <StressChart data={stressChart} />
        </CollapsiblePanel>
      ) : null}

      {hrvChart.length > 0 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:recovery-hrv"
          title="HRV-trend"
          bodyClassName="space-y-3 px-5 py-4"
        >
          <p className="text-sm text-muted-foreground">
            HRV (RMSSD) i millisekunder under 28 dagar.
          </p>
          <HrvTrendChart data={hrvChart} />
        </CollapsiblePanel>
      ) : null}

      {stepsChart.length > 0 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:recovery-steps"
          title="Steg 7 dagar"
          bodyClassName="space-y-3 px-5 py-4"
        >
          <p className="text-sm text-muted-foreground">
            Dagliga steg{stepsGoal != null ? " med mållinje" : ""}.
          </p>
          <StepsChart data={stepsChart} goal={stepsGoal} />
        </CollapsiblePanel>
      ) : null}

      <CollapsiblePanel
        storageKey="fk:collapse:recovery-days"
        title="Dagar"
        bodyClassName="px-5 py-4"
      >
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
              {data.daily_health_metrics.map((day) => {
                const sleepSeconds = day.sleep_duration_s;
                const hrvValue = toFiniteNumber(day.hrv_rmssd_ms);
                const rhrValue = toFiniteNumber(day.resting_heart_rate_bpm);
                const localDate = toIsoDate(day.local_date) ?? String(day.local_date);

                return (
                  <TableRow key={day.id}>
                    <TableCell>{localDate}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 tabular-nums",
                          sleepToneClass(sleepSeconds),
                        )}
                      >
                        {sleepSeconds != null
                          ? formatHours(sleepSeconds)
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 tabular-nums",
                          hrvToneClass(hrvValue, hrv.value),
                        )}
                      >
                        {hrvValue != null ? Math.round(hrvValue) : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {rhrValue != null ? Math.round(rhrValue) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {day.steps != null
                        ? day.steps.toLocaleString("sv-SE")
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CollapsiblePanel>
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
