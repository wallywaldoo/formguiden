import { RUN_FAMILY } from "@/lib/analytics/types";
import type { ActivityPoint } from "@/lib/analytics/types";

export function isRunFamily(activityType: string): boolean {
  return (RUN_FAMILY as readonly string[]).includes(activityType);
}

export function runFamilyActivities(
  activities: ActivityPoint[],
): ActivityPoint[] {
  return activities.filter((activity) => isRunFamily(activity.activityType));
}
