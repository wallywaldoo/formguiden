import Link from "next/link";

import { ACTIVITY_TYPE_LABEL } from "@/features/imports/labels";
import { formatDistanceKm } from "@/lib/units/format";
import { formatDurationHms, formatPaceMinPerKm } from "@/lib/units/pace";

export type TodayActivity = {
  id: string;
  activityType: string;
  startedAt: string;
  distanceM: number | null;
  durationS: number | null;
  paceSPerKm: number | null;
  caloriesKcal: number | null;
};

export function OverviewTodayActivity({
  activities,
  distanceUnit,
  embedded = false,
}: {
  activities: TodayActivity[];
  distanceUnit: "km" | "mi";
  embedded?: boolean;
}) {
  if (activities.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      {embedded ? null : (
        <h2 className="px-0.5 text-[0.82rem] font-medium text-muted-foreground">
          Dagens pass
        </h2>
      )}
      <div className="space-y-2">
        {activities.map((activity) => {
          const href =
            activity.activityType === "strength"
              ? "/strength"
              : `/running/${activity.id}`;
          const label =
            ACTIVITY_TYPE_LABEL[activity.activityType] ?? activity.activityType;
          const time = new Date(activity.startedAt).toLocaleTimeString("sv-SE", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const stats = [
            activity.distanceM != null
              ? formatDistanceKm(activity.distanceM, distanceUnit)
              : null,
            activity.paceSPerKm != null
              ? `${formatPaceMinPerKm(activity.paceSPerKm)} /km`
              : null,
            activity.durationS != null
              ? formatDurationHms(activity.durationS)
              : null,
            activity.caloriesKcal != null
              ? `${Math.round(activity.caloriesKcal)} kcal`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <Link
              key={activity.id}
              href={href}
              className="surface-soft flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/55"
            >
              <div className="min-w-0">
                <p className="font-medium">{label}</p>
                <p className="mt-0.5 truncate text-[0.82rem] text-muted-foreground">
                  {stats || time}
                </p>
              </div>
              <p className="shrink-0 text-[0.82rem] text-muted-foreground tabular-nums">
                {time}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
