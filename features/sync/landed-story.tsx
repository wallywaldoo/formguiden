import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ACTIVITY_TYPE_LABEL } from "@/features/imports/labels";
import { toFiniteNumber } from "@/lib/numbers";
import { formatPaceMinPerKm } from "@/lib/units/pace";

export function LandedStory({
  activities,
  healthCount,
  bodyCount,
  duplicateCount,
}: {
  activities: Array<{
    id: string;
    activity_type: string;
    started_at: string;
    distance_m: unknown;
    avg_pace_s_per_km: unknown;
  }>;
  healthCount: number;
  bodyCount: number;
  duplicateCount: number;
}) {
  const distanceKm = activities.reduce((sum, activity) => {
    const meters = toFiniteNumber(activity.distance_m);
    return sum + (meters ?? 0);
  }, 0);
  const headline =
    activities.length === 0 && duplicateCount > 0
      ? "Du är redan à jour."
      : activities.length === 1
        ? "Passet är inne."
        : `${activities.length} pass landade.`;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Efter passet
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          {headline}
        </h1>
        <p className="max-w-xl text-muted-foreground text-pretty">
          {distanceKm > 0
            ? `${(distanceKm / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km inlästa.`
            : "Inget nytt löppass den här gången."}{" "}
          {healthCount > 0 ? `${healthCount} hälsodagar. ` : null}
          {bodyCount > 0 ? `${bodyCount} kroppsmått. ` : null}
          {duplicateCount > 0
            ? `${duplicateCount} rader fanns redan och hoppades över.`
            : "Inget skrevs över."}
        </p>
      </div>

      {activities.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Det som just landade</CardTitle>
            <CardDescription>
              Coaching uppdateras från den här datan, inte från gissningar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.map((activity) => {
              const pace = toFiniteNumber(activity.avg_pace_s_per_km);
              const meters = toFiniteNumber(activity.distance_m);
              return (
                <div
                  key={activity.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {ACTIVITY_TYPE_LABEL[activity.activity_type] ??
                        activity.activity_type}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(activity.started_at).toLocaleString("sv-SE")}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {meters != null ? `${(meters / 1000).toFixed(2)} km` : "—"}
                    {pace != null ? ` · ${formatPaceMinPerKm(pace)} /km` : ""}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/overview">Till översikten</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/report">Se veckorapporten</Link>
        </Button>
      </div>
    </div>
  );
}
