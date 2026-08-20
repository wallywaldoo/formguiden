import Link from "next/link";
import { Check } from "lucide-react";

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

function activityHref(activity: TodayActivity): string {
  return activity.activityType === "strength"
    ? "/strength"
    : `/running/${activity.id}`;
}

function activityLabel(activity: TodayActivity): string {
  return ACTIVITY_TYPE_LABEL[activity.activityType] ?? activity.activityType;
}

function activityTime(activity: TodayActivity): string {
  return new Date(activity.startedAt).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function activityStats(
  activity: TodayActivity,
  distanceUnit: "km" | "mi",
): Array<{ label: string; value: string }> {
  return [
    activity.distanceM != null
      ? {
          label: "Distans",
          value: formatDistanceKm(activity.distanceM, distanceUnit),
        }
      : null,
    activity.paceSPerKm != null
      ? {
          label: "Tempo",
          value: `${formatPaceMinPerKm(activity.paceSPerKm)} /km`,
        }
      : null,
    activity.durationS != null
      ? { label: "Tid", value: formatDurationHms(activity.durationS) }
      : null,
    activity.caloriesKcal != null
      ? {
          label: "Kcal",
          value: `${Math.round(activity.caloriesKcal)}`,
        }
      : null,
  ].filter((row): row is { label: string; value: string } => row != null);
}

export function OverviewTodayActivity({
  activities,
  distanceUnit,
  embedded = false,
  completed = false,
}: {
  activities: TodayActivity[];
  distanceUnit: "km" | "mi";
  embedded?: boolean;
  completed?: boolean;
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
          const href = activityHref(activity);
          const label = activityLabel(activity);
          const time = activityTime(activity);
          const stats = activityStats(activity, distanceUnit);

          if (completed) {
            return (
              <Link
                key={activity.id}
                href={href}
                aria-label={`${label}, klart ${time}`}
                className="surface-soft block px-4 py-3.5 transition-colors hover:bg-white/55"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/70">
                      <Check
                        className="size-3.5"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    </span>
                    <p className="truncate font-medium">{label}</p>
                  </div>
                  <p className="shrink-0 text-[0.82rem] text-muted-foreground tabular-nums">
                    {time}
                  </p>
                </div>
                {stats.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {stats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-[1rem] bg-white/55 px-3 py-2"
                      >
                        <p className="text-[0.68rem] font-medium text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="mt-0.5 text-[0.92rem] font-semibold tabular-nums">
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Link>
            );
          }

          return (
            <Link
              key={activity.id}
              href={href}
              className="surface-soft flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/55"
            >
              <div className="min-w-0">
                <p className="font-medium">{label}</p>
                <p className="mt-0.5 truncate text-[0.82rem] text-muted-foreground">
                  {stats.map((stat) => stat.value).join(" · ") || time}
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
