import Link from "next/link";

import { CollapsiblePanel } from "@/components/dashboard/collapsible-panel";
import { WeekSchedule } from "@/features/dashboard/week-schedule";
import { WeekRecapCard } from "@/features/dashboard/week-recap";
import {
  OverviewTodayActivity,
  type TodayActivity,
} from "@/features/dashboard/overview-today-activity";
import { isRunFamily } from "@/lib/analytics/running-filter";
import { median } from "@/lib/analytics/stats";
import type { WeekRecap } from "@/lib/analytics/week-recap";
import { type WeekPlan } from "@/lib/training-plan/schema";
import { formatDistanceKm } from "@/lib/units/format";
import { formatPaceMinPerKm } from "@/lib/units/pace";

function Meter({ ratio }: { ratio: number }) {
  const width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/55">
      <div className="h-full rounded-full bg-foreground/80" style={{ width }} />
    </div>
  );
}

function StatTile({
  href,
  label,
  value,
  detail,
  meter,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  meter?: number | null;
}) {
  return (
    <Link
      href={href}
      className="surface-tile flex flex-col px-3.5 py-3 transition-colors hover:bg-white/55"
    >
      <p className="text-[0.75rem] font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[1.15rem] font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[0.75rem] text-muted-foreground">{detail}</p>
      {meter != null ? <Meter ratio={meter} /> : null}
    </Link>
  );
}

export function OverviewWeek({
  week,
  todayDate,
  weeklyDistanceM,
  weeklyGoalM,
  weekSteps,
  distanceUnit,
  activities,
  recap,
}: {
  week: WeekPlan | null;
  todayDate: string;
  weeklyDistanceM: number | null;
  weeklyGoalM: number | null;
  weekSteps: number | null;
  distanceUnit: "km" | "mi";
  activities: TodayActivity[];
  recap: WeekRecap | null;
}) {
  const distanceLabel =
    weeklyDistanceM != null
      ? formatDistanceKm(weeklyDistanceM, distanceUnit)
      : "—";
  const distanceDetail =
    weeklyGoalM != null
      ? `Mål ${formatDistanceKm(weeklyGoalM, distanceUnit)}`
      : "Inget veckomål";
  const distanceRatio =
    weeklyDistanceM != null && weeklyGoalM != null && weeklyGoalM > 0
      ? weeklyDistanceM / weeklyGoalM
      : null;

  const runPaces = activities
    .filter(
      (activity) =>
        isRunFamily(activity.activityType) && activity.paceSPerKm != null,
    )
    .map((activity) => activity.paceSPerKm!);
  const meanPace = median(runPaces);
  const paceLabel =
    meanPace != null ? `${formatPaceMinPerKm(meanPace)} /km` : "—";
  const paceDetail =
    runPaces.length > 0 ? "löppass den här veckan" : "Inget tempo";

  const stepsLabel =
    weekSteps != null ? weekSteps.toLocaleString("sv-SE") : "—";
  const sessionCount = activities.length;
  const sessionLabel = sessionCount > 0 ? String(sessionCount) : "—";
  const sessionDetail = "denna vecka";

  return (
    <CollapsiblePanel
      storageKey="fk:collapse:week"
      title="Vecka"
      bodyClassName="space-y-4 px-5 py-4"
    >
      {recap ? <WeekRecapCard recap={recap} variant="monday" /> : null}

      {week ? <WeekSchedule week={week} todayDate={todayDate} /> : null}

      <div className="space-y-2">
        <p className="text-[0.82rem] font-medium text-muted-foreground">
          Veckans pass
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            href="/running"
            label="Distans"
            value={distanceLabel}
            detail={distanceDetail}
            meter={distanceRatio}
          />
          <StatTile
            href="/running"
            label="Medeltempo"
            value={paceLabel}
            detail={paceDetail}
          />
          <StatTile
            href="/recovery"
            label="Steg"
            value={stepsLabel}
            detail="totalt"
          />
          <StatTile
            href="/running"
            label="Pass"
            value={sessionLabel}
            detail={sessionDetail}
          />
        </div>
        {activities.length > 0 ? (
          <OverviewTodayActivity
            embedded
            activities={activities}
            distanceUnit={distanceUnit}
          />
        ) : (
          <p className="px-0.5 text-[0.75rem] text-muted-foreground">
            Inga pass loggade den här veckan ännu.
          </p>
        )}
      </div>
    </CollapsiblePanel>
  );
}
