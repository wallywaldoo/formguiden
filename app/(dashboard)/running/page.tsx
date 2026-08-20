import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { mapActivityRow } from "@/features/dashboard/map-rows";
import { RunningDesk } from "@/features/running/running-desk";
import type { RunActivityView } from "@/features/running/types";
import { parseRunningRange } from "@/lib/analytics/running";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import {
  getGarminIntegrationStatus,
  listRunActivities,
} from "@/lib/db/queries";
import { readGarminFitnessMetadata } from "@/lib/garmin/fitness";
import { hasRunningRecords } from "@/lib/garmin/personal-records";
import { toFiniteNumber } from "@/lib/numbers";

export default async function RunningPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const now = new Date();
  const { range } = await searchParams;
  const initialRange = parseRunningRange(range);

  let data: Awaited<ReturnType<typeof listRunActivities>> | null = null;
  let garminIntegration: Awaited<
    ReturnType<typeof getGarminIntegrationStatus>
  > = null;
  try {
    const [listed, garmin] = await Promise.all([
      listRunActivities(),
      getGarminIntegrationStatus().catch(() => null),
    ]);
    data = listed;
    garminIntegration = garmin;
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Löpning</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const preferences = data.user_preferences[0];
  const timeZone = preferences?.timezone || DEFAULT_TIMEZONE;
  const distanceUnit = preferences?.distance_unit === "mi" ? "mi" : "km";
  const elevationUnit = preferences?.elevation_unit === "ft" ? "ft" : "m";
  const weeklyGoalM = toFiniteNumber(data.goals[0]?.weekly_run_distance_m);
  const personalRecords =
    readGarminFitnessMetadata(garminIntegration?.metadata ?? null)
      ?.personalRecords ?? null;

  const activities: RunActivityView[] = data.activities.map((row) => {
    const mapped = mapActivityRow(row);
    return {
      ...mapped,
      elevationGainM: toFiniteNumber(row.elevation_gain_m),
      caloriesKcal: toFiniteNumber(row.calories_kcal),
      notes: row.notes,
      detailHydrated: row.detail_hydrated_at != null,
    };
  });

  return (
    <RunningDesk
      nowIso={now.toISOString()}
      timeZone={timeZone}
      initialRange={initialRange}
      activities={activities}
      weeklyGoalM={weeklyGoalM}
      distanceUnit={distanceUnit}
      elevationUnit={elevationUnit}
      personalRecords={
        personalRecords && hasRunningRecords(personalRecords)
          ? personalRecords
          : null
      }
    />
  );
}
