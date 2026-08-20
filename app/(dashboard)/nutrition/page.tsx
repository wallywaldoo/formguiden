import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { CollapsiblePanel } from "@/components/dashboard/collapsible-panel";
import { deleteHydrationEntryAction } from "@/features/hydration/actions";
import { HydrationForm } from "@/features/hydration/hydration-form";
import { DeleteLogButton } from "@/features/logging/delete-log-button";
import {
  BEVERAGE_TYPE_LABEL,
  MEAL_TYPE_LABEL,
  PROVENANCE_LABEL,
} from "@/features/logging/labels";
import { deleteNutritionEntryAction } from "@/features/nutrition/actions";
import {
  CalorieTrendChart,
  HydrationTrendChart,
  MacroDonutChart,
} from "@/features/nutrition/charts";
import { NutritionDesk } from "@/features/nutrition/nutrition-desk";
import { isNutritionAiEnabled } from "@/lib/ai/nutrition/create-estimator";
import { dailyEnergyBalance } from "@/lib/analytics/daily-energy";
import { addDays, toDatetimeLocal, toLocalDate } from "@/lib/analytics/dates";
import {
  DEFAULT_HYDRATION_TARGET_ML,
  DEFAULT_TIMEZONE,
} from "@/lib/constants";
import { listNutrition } from "@/lib/db/queries";
import { toFiniteNumber } from "@/lib/numbers";
import { formatVolumeMl } from "@/lib/units/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

const DEFAULT_CALORIE_GUIDE_KCAL = 2000;

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
    data = await listNutrition(since);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Kost</h1>
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

  const todayHydration = data.hydration_entries.filter(
    (row) => toLocalDate(row.consumed_at, timeZone) === today,
  );
  const recentHydration = data.hydration_entries.filter(
    (row) => toLocalDate(row.consumed_at, timeZone) !== today,
  );
  const todayVolume = todayHydration.reduce(
    (sum, row) => sum + (toFiniteNumber(row.volume_ml) ?? 0),
    0,
  );
  const todayCaffeine = todayHydration.reduce(
    (sum, row) => sum + (toFiniteNumber(row.caffeine_mg) ?? 0),
    0,
  );

  const todayFood = data.nutrition_entries.filter(
    (row) => toLocalDate(row.eaten_at, timeZone) === today,
  );
  const recentFood = data.nutrition_entries.filter(
    (row) => toLocalDate(row.eaten_at, timeZone) !== today,
  );
  const todayTotals = sumMacros(todayFood);

  const calorieSeries = buildDailySeries(14, today, (date) =>
    data!.nutrition_entries
      .filter((row) => toLocalDate(row.eaten_at, timeZone) === date)
      .reduce((sum, row) => sum + (toFiniteNumber(row.energy_kcal) ?? 0), 0),
  ).map(({ date, value }) => ({ date, kcal: Math.round(value) }));

  const energy = dailyEnergyBalance({
    massKg: toFiniteNumber(data.latest_mass_kg),
    heightCm: toFiniteNumber(data.profile?.height_cm),
    birthDate: data.profile?.date_of_birth ?? null,
    sex: data.profile?.sex_at_birth ?? null,
    loggedKcal: todayTotals.kcal,
    activityKcal: 0,
    now,
  });
  const guideKcal = energy?.maintenanceKcal ?? DEFAULT_CALORIE_GUIDE_KCAL;
  const guideLabel =
    energy != null ? `TDEE ${guideKcal}` : `Riktlinje ${guideKcal}`;
  const remainingKcal = energy?.remainingKcal ?? null;

  const weekStart = addDays(today, -6);
  const weekEntries = data.nutrition_entries.filter((row) => {
    const local = toLocalDate(row.eaten_at, timeZone);
    return local >= weekStart && local <= today;
  });
  const macroSource = hasMacroData(todayFood) ? todayFood : weekEntries;
  const macroScope = hasMacroData(todayFood) ? "today" : "week";
  const macroTotals = sumMacros(macroSource);
  const macroTotalG =
    macroTotals.protein + macroTotals.carbs + macroTotals.fat;
  const macroSlices =
    macroTotalG > 0
      ? (
          [
            {
              key: "protein" as const,
              label: "Protein",
              grams: macroTotals.protein,
            },
            {
              key: "carbs" as const,
              label: "Kolhydrater",
              grams: macroTotals.carbs,
            },
            {
              key: "fat" as const,
              label: "Fett",
              grams: macroTotals.fat,
            },
          ] as const
        )
          .filter((row) => row.grams > 0)
          .map((row) => ({
            ...row,
            percent: Math.round((row.grams / macroTotalG) * 100),
          }))
      : [];

  const hydrationSeries = buildDailySeries(7, today, (date) =>
    data!.hydration_entries
      .filter((row) => toLocalDate(row.consumed_at, timeZone) === date)
      .reduce((sum, row) => sum + (toFiniteNumber(row.volume_ml) ?? 0), 0),
  ).map(({ date, value }) => ({ date, ml: Math.round(value) }));
  const hydrationGoal = DEFAULT_HYDRATION_TARGET_ML;
  const hydrationRemaining = Math.max(0, hydrationGoal - todayVolume);

  const hasCalorieData = calorieSeries.some((row) => row.kcal > 0);
  const hasHydrationData = hydrationSeries.some((row) => row.ml > 0);

  return (
    <div className="space-y-5">
      <h1 className="page-title">Kost</h1>

      <Tabs defaultValue={tab === "hydration" ? "hydration" : "food"}>
        <TabsList className="flex h-11 w-full flex-row flex-nowrap gap-1 rounded-2xl border border-white/45 bg-white/45 p-1 shadow-none">
          <TabsTrigger value="food" className="h-full min-h-0 flex-1">
            Mat
          </TabsTrigger>
          <TabsTrigger value="hydration" className="h-full min-h-0 flex-1">
            Vätska
          </TabsTrigger>
        </TabsList>

        <TabsContent value="food" className="mt-5 space-y-5">
          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 px-0.5">
              <h2 className="text-[0.82rem] font-medium text-muted-foreground">
                Idag
              </h2>
              {remainingKcal != null ? (
                <p className="text-[0.75rem] text-muted-foreground">
                  {Math.round(remainingKcal).toLocaleString("sv-SE")} kcal kvar
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatTile
                label="kcal"
                value={
                  todayTotals.kcal > 0
                    ? Math.round(todayTotals.kcal).toLocaleString("sv-SE")
                    : "—"
                }
              />
              <StatTile
                label="Protein"
                value={
                  todayTotals.protein > 0
                    ? `${Math.round(todayTotals.protein)} g`
                    : "—"
                }
              />
              <StatTile
                label="Kolhydrater"
                value={
                  todayTotals.carbs > 0
                    ? `${Math.round(todayTotals.carbs)} g`
                    : "—"
                }
              />
              <StatTile
                label="Fett"
                value={
                  todayTotals.fat > 0
                    ? `${Math.round(todayTotals.fat)} g`
                    : "—"
                }
              />
            </div>
          </section>

          <NutritionDesk
            timeZone={timeZone}
            nowLocal={nowLocal}
            massUnit={massUnit}
            aiEnabled={isNutritionAiEnabled()}
            remainingKcal={remainingKcal}
          >
            <LogSection
              title="Loggat idag"
              empty="Ingen mat loggad idag."
              count={todayFood.length}
            >
              {todayFood.map((row) => (
                <FoodLogCard key={row.id} row={row} timeZone={timeZone} />
              ))}
            </LogSection>

            <LogSection
              title="Senaste"
              empty="Inga tidigare måltider de senaste 28 dagarna."
              count={recentFood.length}
            >
              {recentFood.map((row) => (
                <FoodLogCard key={row.id} row={row} timeZone={timeZone} />
              ))}
            </LogSection>

            {hasCalorieData || macroSlices.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {hasCalorieData ? (
                  <CollapsiblePanel
                    storageKey="fk:collapse:nutrition-calories"
                    title="Kalorier senaste 14 dagarna"
                    bodyClassName="px-4 py-4 md:px-5"
                  >
                    <CalorieTrendChart
                      data={calorieSeries}
                      guideKcal={guideKcal}
                      guideLabel={guideLabel}
                    />
                  </CollapsiblePanel>
                ) : null}
                {macroSlices.length > 0 ? (
                  <CollapsiblePanel
                    storageKey="fk:collapse:nutrition-macros"
                    title={
                      macroScope === "today"
                        ? "Makron idag"
                        : "Makron senaste 7 dagarna"
                    }
                    bodyClassName="px-4 py-4 md:px-5"
                  >
                    <MacroDonutChart data={macroSlices} />
                  </CollapsiblePanel>
                ) : null}
              </div>
            ) : null}
          </NutritionDesk>
        </TabsContent>

        <TabsContent value="hydration" className="mt-5 space-y-5">
          <section className="space-y-2">
            <h2 className="px-0.5 text-[0.82rem] font-medium text-muted-foreground">
              Idag
            </h2>
            <div className="grid grid-cols-4 gap-2">
              <StatTile
                label="Drucket"
                value={
                  todayVolume > 0
                    ? formatVolumeMl(todayVolume, volumeUnit)
                    : "—"
                }
              />
              <StatTile
                label="Kvar"
                value={formatVolumeMl(hydrationRemaining, volumeUnit)}
              />
              <StatTile
                label="Poster"
                value={
                  todayHydration.length > 0
                    ? String(todayHydration.length)
                    : "—"
                }
              />
              <StatTile
                label="Koffein"
                value={
                  todayCaffeine > 0 ? `${Math.round(todayCaffeine)} mg` : "—"
                }
              />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="px-0.5 text-[0.82rem] font-medium text-muted-foreground">
              Logga vätska
            </h2>
            <div className="surface px-4 py-4 md:px-5">
              <HydrationForm
                timeZone={timeZone}
                nowLocal={nowLocal}
                volumeUnit={volumeUnit}
              />
            </div>
          </section>

          <LogSection
            title="Loggat idag"
            empty="Ingen vätska loggad idag."
            count={todayHydration.length}
          >
            {todayHydration.map((row) => (
              <DrinkLogCard
                key={row.id}
                row={row}
                timeZone={timeZone}
                volumeUnit={volumeUnit}
              />
            ))}
          </LogSection>

          <LogSection
            title="Senaste"
            empty="Inga tidigare poster de senaste 28 dagarna."
            count={recentHydration.length}
          >
            {recentHydration.map((row) => (
              <DrinkLogCard
                key={row.id}
                row={row}
                timeZone={timeZone}
                volumeUnit={volumeUnit}
              />
            ))}
          </LogSection>

          {hasHydrationData ? (
            <CollapsiblePanel
              storageKey="fk:collapse:nutrition-hydration"
              title="Vätska senaste 7 dagarna"
              bodyClassName="px-4 py-4 md:px-5"
            >
              <HydrationTrendChart
                data={hydrationSeries}
                goalMl={hydrationGoal}
              />
            </CollapsiblePanel>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-tile min-w-0 px-2 py-2.5 text-center">
      <p className="truncate text-[0.65rem] font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[0.92rem] font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function LogSection({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="px-0.5 text-[0.82rem] font-medium text-muted-foreground">
        {title}
      </h2>
      {count === 0 ? (
        <p className="px-0.5 text-[0.82rem] text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function formatWhen(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FoodLogCard({
  row,
  timeZone,
}: {
  row: NutritionPayload["nutrition_entries"][number];
  timeZone: string;
}) {
  const kcal = toFiniteNumber(row.energy_kcal);
  const protein = toFiniteNumber(row.protein_g);
  const facts = [
    kcal != null ? `${Math.round(kcal)} kcal` : null,
    protein != null ? `${Math.round(protein)} g protein` : null,
    PROVENANCE_LABEL[row.provenance] ?? null,
  ].filter(Boolean);

  return (
    <div className="surface-tile flex items-start gap-2 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[0.88rem] font-medium">
            {MEAL_TYPE_LABEL[row.meal_type] ?? row.meal_type}
          </p>
          <p className="shrink-0 text-[0.72rem] text-muted-foreground">
            {formatWhen(row.eaten_at, timeZone)}
          </p>
        </div>
        <p className="mt-0.5 truncate text-[0.82rem] text-muted-foreground">
          {row.description}
        </p>
        {facts.length > 0 ? (
          <p className="mt-1 text-[0.75rem] text-muted-foreground tabular-nums">
            {facts.join(" · ")}
          </p>
        ) : null}
      </div>
      <DeleteLogButton
        action={deleteNutritionEntryAction}
        id={row.id}
        label="Ta bort måltid?"
        description="Måltiden raderas från din logg."
      />
    </div>
  );
}

function DrinkLogCard({
  row,
  timeZone,
  volumeUnit,
}: {
  row: NutritionPayload["hydration_entries"][number];
  timeZone: string;
  volumeUnit: "ml" | "floz";
}) {
  const volume = toFiniteNumber(row.volume_ml);
  const caffeine = toFiniteNumber(row.caffeine_mg);
  const facts = [
    volume != null ? formatVolumeMl(volume, volumeUnit) : null,
    caffeine != null ? `${Math.round(caffeine)} mg koffein` : null,
  ].filter(Boolean);

  return (
    <div className="surface-tile flex items-start gap-2 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[0.88rem] font-medium">
            {BEVERAGE_TYPE_LABEL[row.beverage_type] ?? row.beverage_type}
          </p>
          <p className="shrink-0 text-[0.72rem] text-muted-foreground">
            {formatWhen(row.consumed_at, timeZone)}
          </p>
        </div>
        {facts.length > 0 ? (
          <p className="mt-1 text-[0.75rem] text-muted-foreground tabular-nums">
            {facts.join(" · ")}
          </p>
        ) : null}
      </div>
      <DeleteLogButton
        action={deleteHydrationEntryAction}
        id={row.id}
        label="Ta bort vätska?"
        description="Posten raderas från din logg."
      />
    </div>
  );
}

function buildDailySeries(
  days: number,
  today: string,
  valueForDate: (date: string) => number,
): Array<{ date: string; value: number }> {
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, -(days - 1 - index));
    return { date, value: valueForDate(date) };
  });
}

function sumMacros(
  entries: Array<{
    energy_kcal: unknown;
    protein_g: unknown;
    carbohydrate_g: unknown;
    fat_g: unknown;
    fiber_g: unknown;
  }>,
) {
  return entries.reduce(
    (acc, row) => ({
      kcal: acc.kcal + (toFiniteNumber(row.energy_kcal) ?? 0),
      protein: acc.protein + (toFiniteNumber(row.protein_g) ?? 0),
      carbs: acc.carbs + (toFiniteNumber(row.carbohydrate_g) ?? 0),
      fat: acc.fat + (toFiniteNumber(row.fat_g) ?? 0),
      fiber: acc.fiber + (toFiniteNumber(row.fiber_g) ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

function hasMacroData(
  entries: Array<{
    protein_g: unknown;
    carbohydrate_g: unknown;
    fat_g: unknown;
  }>,
): boolean {
  return entries.some(
    (row) =>
      toFiniteNumber(row.protein_g) != null ||
      toFiniteNumber(row.carbohydrate_g) != null ||
      toFiniteNumber(row.fat_g) != null,
  );
}

type NutritionPayload = {
  user_preferences: Array<{
    timezone: string;
    locale: string;
    mass_unit: string;
    volume_unit: string;
  }>;
  profile: {
    date_of_birth: string | null;
    sex_at_birth: string | null;
    height_cm: unknown;
  } | null;
  latest_mass_kg: unknown;
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
