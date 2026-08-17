import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { deleteHydrationEntryAction } from "@/features/hydration/actions";
import { HydrationForm } from "@/features/hydration/hydration-form";
import { DeleteLogButton } from "@/features/logging/delete-log-button";
import {
  BEVERAGE_TYPE_LABEL,
  MEAL_TYPE_LABEL,
  PROVENANCE_LABEL,
} from "@/features/logging/labels";
import { deleteNutritionEntryAction } from "@/features/nutrition/actions";
import { NutritionForm } from "@/features/nutrition/nutrition-form";
import { isNutritionAiEnabled } from "@/lib/ai/nutrition/create-estimator";
import { toDatetimeLocal, toLocalDate } from "@/lib/analytics/dates";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { graphqlRequest } from "@/lib/graphql/client";
import { LIST_NUTRITION } from "@/lib/graphql/queries/logging";
import { toFiniteNumber } from "@/lib/numbers";
import { formatVolumeMl } from "@/lib/units/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const now = new Date();
  const since = new Date(now.getTime() - 28 * 86_400_000).toISOString();

  let data: NutritionPayload | null = null;
  try {
    data = await graphqlRequest<NutritionPayload>(LIST_NUTRITION, { since });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Kost</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const timeZone = data.user_preferences[0]?.timezone || DEFAULT_TIMEZONE;
  const massUnit = data.user_preferences[0]?.mass_unit === "lb" ? "lb" : "kg";
  const volumeUnit =
    data.user_preferences[0]?.volume_unit === "floz" ? "floz" : "ml";
  const nowLocal = toDatetimeLocal(now.toISOString(), timeZone);
  const today = toLocalDate(now.toISOString(), timeZone);
  const todayVolume = data.hydration_entries
    .filter((row) => toLocalDate(row.consumed_at, timeZone) === today)
    .reduce((sum, row) => sum + (toFiniteNumber(row.volume_ml) ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Kost</h1>
        <p className="text-muted-foreground">
          Manuell mat- och vätskelogg. AI-uppskattning är avstängd tills en
          leverantör godkänns.
        </p>
      </div>

      <Tabs defaultValue={tab === "hydration" ? "hydration" : "food"}>
        <TabsList>
          <TabsTrigger value="food">Mat</TabsTrigger>
          <TabsTrigger value="hydration">Vätska</TabsTrigger>
        </TabsList>
        <TabsContent value="food" className="mt-6 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Ny måltid</CardTitle>
              <CardDescription>
                Spara beskrivningen även om du hoppar över kalorier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NutritionForm
                timeZone={timeZone}
                nowLocal={nowLocal}
                massUnit={massUnit}
                aiEnabled={isNutritionAiEnabled()}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Senaste 28 dagarna</CardTitle>
            </CardHeader>
            <CardContent>
              {data.nutrition_entries.length === 0 ? (
                <Empty className="border-border">
                  <EmptyHeader>
                    <EmptyTitle>Ingen mat loggad</EmptyTitle>
                    <EmptyDescription>
                      Börja med en kort beskrivning av frukost eller lunch.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tid</TableHead>
                      <TableHead>Måltid</TableHead>
                      <TableHead>Beskrivning</TableHead>
                      <TableHead>kcal</TableHead>
                      <TableHead>Källa</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.nutrition_entries.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {new Date(row.eaten_at).toLocaleString("sv-SE")}
                        </TableCell>
                        <TableCell>
                          {MEAL_TYPE_LABEL[row.meal_type] ?? row.meal_type}
                        </TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell>
                          {toFiniteNumber(row.energy_kcal) ?? "—"}
                        </TableCell>
                        <TableCell>
                          {PROVENANCE_LABEL[row.provenance] ?? row.provenance}
                        </TableCell>
                        <TableCell className="text-right">
                          <DeleteLogButton
                            action={deleteNutritionEntryAction}
                            id={row.id}
                            label="Ta bort måltid?"
                            description="Måltiden raderas från din logg."
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="hydration" className="mt-6 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Ny vätska</CardTitle>
              <CardDescription>
                I dag:{" "}
                {todayVolume > 0
                  ? formatVolumeMl(todayVolume, volumeUnit)
                  : "—"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HydrationForm
                timeZone={timeZone}
                nowLocal={nowLocal}
                volumeUnit={volumeUnit}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Senaste 28 dagarna</CardTitle>
            </CardHeader>
            <CardContent>
              {data.hydration_entries.length === 0 ? (
                <Empty className="border-border">
                  <EmptyHeader>
                    <EmptyTitle>Ingen vätska loggad</EmptyTitle>
                    <EmptyDescription>
                      Logga ett glas vatten för att komma igång.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tid</TableHead>
                      <TableHead>Dryck</TableHead>
                      <TableHead>Volym</TableHead>
                      <TableHead>Koffein</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.hydration_entries.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {new Date(row.consumed_at).toLocaleString("sv-SE")}
                        </TableCell>
                        <TableCell>
                          {BEVERAGE_TYPE_LABEL[row.beverage_type] ??
                            row.beverage_type}
                        </TableCell>
                        <TableCell>
                          {toFiniteNumber(row.volume_ml) != null
                            ? formatVolumeMl(
                                toFiniteNumber(row.volume_ml)!,
                                volumeUnit,
                              )
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {toFiniteNumber(row.caffeine_mg) != null
                            ? `${Math.round(toFiniteNumber(row.caffeine_mg)!)} mg`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DeleteLogButton
                            action={deleteHydrationEntryAction}
                            id={row.id}
                            label="Ta bort vätska?"
                            description="Posten raderas från din logg."
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type NutritionPayload = {
  user_preferences: Array<{
    timezone: string;
    locale: string;
    mass_unit: string;
    volume_unit: string;
  }>;
  nutrition_entries: Array<{
    id: string;
    eaten_at: string;
    meal_type: string;
    description: string;
    energy_kcal: unknown;
    protein_g: unknown;
    carbohydrate_g: unknown;
    fat_g: unknown;
    fiber_g: unknown;
    provenance: string;
    notes: string | null;
  }>;
  hydration_entries: Array<{
    id: string;
    consumed_at: string;
    volume_ml: unknown;
    beverage_type: string;
    caffeine_mg: unknown;
    notes: string | null;
  }>;
};
