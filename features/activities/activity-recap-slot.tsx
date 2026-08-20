import { Suspense } from "react";

import { ActivityRecapCard } from "@/features/activities/activity-recap-card";
import { loadActivityRecap } from "@/features/activities/load-recap";
import type { CompareRunInput } from "@/lib/analytics/activity-detail";
import type { DailySession } from "@/lib/training-plan/schema";

async function ActivityRecapLoader({
  activityId,
  planned,
  href,
  recentRuns,
}: {
  activityId: string;
  planned: DailySession | null;
  href?: string;
  recentRuns?: CompareRunInput[];
}) {
  const recap = await loadActivityRecap({
    activityId,
    planned,
    recentRuns,
  });
  if (!recap) return null;
  return <ActivityRecapCard recap={recap} href={href} />;
}

export function ActivityRecapSlot({
  activityId,
  planned,
  href,
  recentRuns,
}: {
  activityId: string;
  planned: DailySession | null;
  href?: string;
  recentRuns?: CompareRunInput[];
}) {
  return (
    <Suspense fallback={null}>
      <ActivityRecapLoader
        activityId={activityId}
        planned={planned}
        href={href}
        recentRuns={recentRuns}
      />
    </Suspense>
  );
}
