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
import { mapBodyRow } from "@/features/dashboard/map-rows";
import { MetricCard } from "@/features/dashboard/metric-card";
import { deleteWeightEntryAction } from "@/features/body/actions";
import { WeightForm } from "@/features/body/weight-form";
import { DeleteLogButton } from "@/features/logging/delete-log-button";
import { BODY_SOURCE_LABEL } from "@/features/logging/labels";
import { bodyWeightTrend, latestMass, massSeries } from "@/lib/analytics/body";
import { toDatetimeLocal } from "@/lib/analytics/dates";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { graphqlRequest } from "@/lib/graphql/client";
import { LIST_BODY } from "@/lib/graphql/queries/dashboard";
import { toFiniteNumber } from "@/lib/numbers";
import { formatMassKg } from "@/lib/units/format";

export default async function BodyPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 100 * 86_400_000).toISOString();

  let data: BodyPayload | null = null;
  try {
    data = await graphqlRequest<BodyPayload>(LIST_BODY, { since });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Kropp</h1>
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

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Kropp</h1>
        <p className="text-muted-foreground">
          Vikt från Garmin-filer och manuell loggning. Saknade fält lämnas
          tomma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logga vikt</CardTitle>
          <CardDescription>
            Manuell mätning lagras som source=manual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeightForm
            timeZone={context.timeZone}
            nowLocal={toDatetimeLocal(now.toISOString(), context.timeZone)}
            massUnit={massUnit}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

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

      {data.body_measurements.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Mätningar</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tid</TableHead>
                  <TableHead>Vikt</TableHead>
                  <TableHead>Fett %</TableHead>
                  <TableHead>Källa</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.body_measurements.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {new Date(row.measured_at).toLocaleString("sv-SE")}
                    </TableCell>
                    <TableCell>
                      {toFiniteNumber(row.mass_kg) != null
                        ? formatMassKg(toFiniteNumber(row.mass_kg)!, massUnit)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {toFiniteNumber(row.body_fat_pct) != null
                        ? `${toFiniteNumber(row.body_fat_pct)!.toFixed(1)} %`
                        : "—"}
                    </TableCell>
                    <TableCell>
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
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

type BodyPayload = {
  user_preferences: Array<{ timezone: string; mass_unit: string }>;
  goals: Array<{ target_mass_kg: unknown }>;
  body_measurements: Array<{
    id: string;
    measured_at: string;
    mass_kg: unknown;
    body_fat_pct: unknown;
    source: string;
  }>;
};
