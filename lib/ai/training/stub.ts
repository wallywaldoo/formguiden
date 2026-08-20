import { fallbackToday, fallbackWeek } from "@/lib/training-plan/fallback";
import type { TrainingPlanGenerator } from "@/lib/ai/training/types";

export class StubTrainingPlanGenerator implements TrainingPlanGenerator {
  readonly provider = "stub" as const;
  readonly model = "stub-v1";

  async generateToday(snapshot: Parameters<TrainingPlanGenerator["generateToday"]>[0]) {
    return fallbackToday(snapshot);
  }

  async generateWeek(snapshot: Parameters<TrainingPlanGenerator["generateWeek"]>[0]) {
    return fallbackWeek(snapshot);
  }
}
