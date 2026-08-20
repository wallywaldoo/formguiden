import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { mapBodyRow } from "@/features/dashboard/map-rows";
import { MetricCard } from "@/features/dashboard/metric-card";
import { deleteWeightEntryAction } from "@/features/body/actions";
import { WeightForm } from "@/features/body/weight-form";
import { DeleteLogButton } from "@/features/logging/delete-log-button";
import { BODY_SOURCE_LABEL } from "@/features/logging/labels";
import {
  bodyFatSeries,
  bodyMassIndex,
  bodyWeightTrend,
  latestMass,
  massGoalProgress,
  massSeries,
} from "@/lib/analytics/body";
import { toDatetimeLocal } from "@/lib/analytics/dates";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { listBodyMeasurements } from "@/lib/db/queries";
import { toFiniteNumber } from "@/lib/numbers";
import { formatMassKg } from "@/lib/units/format";
import { cn } from "@/lib/utils";

export default async function BodyPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 100 * 86_400_000).toISOString();

  let data: BodyPayload | null = null;
  try {
    data = await listBodyMeasurements(since);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Kropp</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const massUnit = data.user_preferences[0]?.mass_unit === "lb" ? "lb" : "kg";
  const context: AnalyticsContext = {
    timeZone: data.user_preferences[0]?.timezone || DEFAULT_TIMEZONE,
    now,
    goal: {
      weeklyRunDistanceM: null,
      targetPaceSPerKm: null,
      targetMassKg: toFiniteNumber(data.goals[0]?.target_mass_kg),
    },
  };
  const points = data.body_measurements.map(mapBodyRow);
  const latest = latestMass(points);
  const trend = bodyWeightTrend(points, context);
  const target = context.goal.targetMassKg;
  const series = massSeries(points, context, 90).map((point) => ({
    date: point.date,
    massKg: point.massKg,
  }));
  const fatSeries = bodyFatSeries(points, context, 90).map((point) => ({
    date: point.date,
    bodyFatPct: point.bodyFatPct,
  }));
  const heightCm = toFiniteNumber(data.profile?.height_cm);
  const bmi = bodyMassIndex(latest, heightCm);
  const startKg = series[0]?.massKg ?? latest;
  const goalPct =
    latest != null && target != null && startKg != null
      ? massGoalProgress(latest, target, startKg)
      : null;

  const measurements = data.body_measurements;
  const rows = measurements.map((row, index) => {
    const mass = toFiniteNumber(row.mass_kg);
    const fat = toFiniteNumber(row.body_fat_pct);
    const older = measurements[index + 1];
    const olderMass = older ? toFiniteNumber(older.mass_kg) : null;
    const olderFat = older ? toFiniteNumber(older.body_fat_pct) : null;
    return {
      ...row,
      mass,
      fat,
      massTrend: trendArrow(mass, olderMass),
      fatTrend: trendArrow(fat, olderFat),
    };
  });

  return (
    <div className="space-y-8">
      <h1 className="page-title">Kropp</h1>

      <Card>
        <CardHeader>
          <CardTitle>Logga vikt</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightForm
            timeZone={context.timeZone}
            nowLocal={toDatetimeLocal(now.toISOString(), context.timeZone)}
            massUnit={massUnit}
          />
        </CardContent>
      </Card>

      <div className={cn("grid gap-4", bmi ? "md:grid-cols-4" : "md:grid-cols-3")}>
        <MetricCard
          title="Senaste vikt"
          value={latest != null ? formatMassKg(latest, massUnit) : "—"}
          caption={
            target != null
              ? `Mål ${formatMassKg(target, massUnit)}`
              : "Inget viktmål"
          }
        />
        <MetricCard
          title="Trend 28 dagar"
          value={
            trend.value != null
              ? `${trend.value >= 0 ? "+" : ""}${trend.value.toFixed(2)} kg/vecka`
              : "—"
          }
          caption="Kräver minst 4 mätningar"
          explanation="Linjär lutning för mass_kg mot kalenderdag, multiplicerad med 7."
        />
        <MetricCard
          title="Mot mål"
          value={
            latest != null && target != null
              ? `${latest - target >= 0 ? "+" : ""}${(latest - target).toFixed(1)} kg`
              : "—"
          }
        />
        {bmi ? (
          <MetricCard
            title="BMI"
            value={bmi.value.toFixed(1)}
            caption={bmi.category}
          />
        ) : null}
      </div>

      {latest != null && target != null && goalPct != null ? (
        <div className="surface-tile space-y-3 px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.78rem] font-medium text-muted-foreground">
                Viktmål
              </p>
              <p className="text-[1.05rem] font-semibold tabular-nums">
                {Math.round(goalPct)} % klart
              </p>
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatMassKg(latest, massUnit)} → {formatMassKg(target, massUnit)}
            </p>
          </div>
          <Progress
            value={goalPct}
            className="h-3 rounded-full border border-white/45 bg-white/45"
            indicatorClassName="rounded-full bg-primary"
          />
          {startKg != null && startKg !== latest ? (
            <p className="text-xs text-muted-foreground">
              Start {formatMassKg(startKg, massUnit)}
            </p>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Vikt 90 dagar</CardTitle>
          <CardDescription>Endast riktiga mätpunkter ritas.</CardDescription>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <DataEmptyState
              title="Ingen vikt ännu"
              description="Logga manuellt ovan, eller importera en FIT/CSV som innehåller mass_kg."
              href="/import"
              action="Hämta in pass"
            />
          ) : (
            <LineMetricChart data={series} dataKey="massKg" label="kg" />
          )}
        </CardContent>
      </Card>

      {fatSeries.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Kroppsfett</CardTitle>
            <CardDescription>Body fat % över tid.</CardDescription>
          </CardHeader>
          <CardContent>
            <LineMetricChart
              data={fatSeries}
              dataKey="bodyFatPct"
              label="%"
            />
          </CardContent>
        </Card>
      ) : null}

      {rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Mätningar</CardTitle>
            <CardDescription>
              Pil visar förändring mot föregående mätning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-2xl border border-white/45 bg-white/35">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/40 hover:bg-transparent">
                    <TableHead>Tid</TableHead>
                    <TableHead>Vikt</TableHead>
                    <TableHead>Fett %</TableHead>
                    <TableHead>Källa</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-white/35 hover:bg-white/40"
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(row.measured_at).toLocaleString("sv-SE")}
                      </TableCell>
                      <TableCell>
                        <TrendValue
                          label={
                            row.mass != null
                              ? formatMassKg(row.mass, massUnit)
                              : "—"
                          }
                          trend={row.massTrend}
                        />
                      </TableCell>
                      <TableCell>
                        <TrendValue
                          label={
                            row.fat != null ? `${row.fat.toFixed(1)} %` : "—"
                          }
                          trend={row.fatTrend}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {BODY_SOURCE_LABEL[row.source] ?? row.source}
                      </TableCell>
                      <TableCell className="text-right">
                        <DeleteLogButton
                          action={deleteWeightEntryAction}
                          id={row.id}
                          label="Ta bort mätning?"
                          description="Viktmätningen raderas."
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function trendArrow(
  current: number | null,
  previous: number | null,
): "up" | "down" | "same" | null {
  if (current == null || previous == null) {
    return null;
  }
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) {
    return "same";
  }
  return delta > 0 ? "up" : "down";
}

function TrendValue({
  label,
  trend,
}: {
  label: string;
  trend: "up" | "down" | "same" | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span>{label}</span>
      {trend === "up" ? (
        <span className="text-xs font-medium text-amber-600" aria-label="Ökat">
          ▲
        </span>
      ) : null}
      {trend === "down" ? (
        <span className="text-xs font-medium text-emerald-600" aria-label="Minskat">
          ▼
        </span>
      ) : null}
      {trend === "same" ? (
        <span className="text-xs text-muted-foreground" aria-label="Oförändrat">
          ·
        </span>
      ) : null}
    </span>
  );
}

type BodyPayload = {
  user_preferences: Array<{ timezone: string; mass_unit: string }>;
  goals: Array<{ target_mass_kg: unknown }>;
  profile: { height_cm: unknown } | null;
  body_measurements: Array<{
    id: string;
    measured_at: string;
    mass_kg: unknown;
    body_fat_pct: unknown;
    source: string;
  }>;
};
