import { describe, expect, it } from "vitest";

import { HALF_MARATHON_DISTANCE_M } from "@/lib/constants";
import { buildGoalPayload } from "@/features/goals/map-goal";
import { formatPaceMinPerKm } from "@/lib/units/pace";

describe("buildGoalPayload", () => {
  it("stores derived half-marathon pace for 1:30", () => {
    const goal = buildGoalPayload({
      raceType: "half_marathon",
      targetDuration: "01:30:00",
    });

    expect(goal.race_distance_m).toBe(HALF_MARATHON_DISTANCE_M);
    expect(goal.target_duration_s).toBe(5400);
    expect(formatPaceMinPerKm(goal.target_pace_s_per_km!)).toBe("4:16");
  });
});
