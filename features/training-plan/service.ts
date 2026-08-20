import { createTrainingPlanGenerator } from "@/lib/ai/training/create-generator";
import sql from "@/lib/db";
import {
  applyTodayCaps,
  fallbackToday,
  fallbackWeek,
} from "@/lib/training-plan/fallback";
import {
  dailySessionSchema,
  weekPlanSchema,
  type DailySession,
  type WeekPlan,
} from "@/lib/training-plan/schema";
import {
  buildTrainingSnapshot,
  snapshotFingerprint,
  type TrainingSnapshot,
} from "@/lib/training-plan/snapshot";
import { loadTrainingSnapshotInput } from "@/features/training-plan/load";

export type StoredTrainingPlans = {
  today: DailySession;
  week: WeekPlan;
  source: "rules" | "stub" | "openai";
  model: string | null;
  generatedAt: string;
  feedback: string | null;
};

type PlanRow = {
  plan_type: string;
  local_date: string;
  payload: unknown;
  fingerprint: string;
  source: string;
  model: string | null;
  feedback: string | null;
  generated_at: string;
};

async function readPlans(
  today: string,
  weekStart: string,
): Promise<{ daily: PlanRow | null; week: PlanRow | null }> {
  const rows = (await sql`
    SELECT plan_type, local_date::text AS local_date, payload, fingerprint,
           source, model, feedback, generated_at
    FROM training_plans
    WHERE (plan_type = 'daily' AND local_date = ${today})
       OR (plan_type = 'week' AND local_date = ${weekStart})
  `) as unknown as PlanRow[];
  return {
    daily: rows.find((row) => row.plan_type === "daily") ?? null,
    week: rows.find((row) => row.plan_type === "week") ?? null,
  };
}

async function upsertPlan(input: {
  planType: "daily" | "week";
  localDate: string;
  payload: DailySession | WeekPlan;
  ruleCaps: string[];
  fingerprint: string;
  source: "rules" | "stub" | "openai";
  model: string | null;
  feedback: string | null;
}) {
  await sql`
    INSERT INTO training_plans
      (plan_type, local_date, payload, rule_caps, fingerprint, source, model, feedback, generated_at)
    VALUES (
      ${input.planType},
      ${input.localDate},
      ${sql.json(input.payload)},
      ${sql.json(input.ruleCaps)},
      ${input.fingerprint},
      ${input.source},
      ${input.model},
      ${input.feedback},
      now()
    )
    ON CONFLICT (plan_type, local_date)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      rule_caps = EXCLUDED.rule_caps,
      fingerprint = EXCLUDED.fingerprint,
      source = EXCLUDED.source,
      model = EXCLUDED.model,
      feedback = EXCLUDED.feedback,
      generated_at = now(),
      updated_at = now()
  `;
}

async function generatePlans(snapshot: TrainingSnapshot): Promise<{
  today: DailySession;
  week: WeekPlan;
  source: "rules" | "stub" | "openai";
  model: string | null;
}> {
  const generator = createTrainingPlanGenerator();
  if (!generator) {
    return {
      today: fallbackToday(snapshot),
      week: fallbackWeek(snapshot),
      source: "rules",
      model: null,
    };
  }

  try {
    const week = await generator.generateWeek(snapshot);
    const todayRaw = week.days.find(
      (day) => day.localDate === snapshot.localDate,
    );
    const today = applyTodayCaps(todayRaw ?? fallbackToday(snapshot), snapshot);
    const days = week.days.map((day) =>
      day.localDate === snapshot.localDate ? today : day,
    );
    return {
      today,
      week: { weekStart: snapshot.weekStart, days },
      source: generator.provider,
      model: generator.model,
    };
  } catch {
    return {
      today: fallbackToday(snapshot),
      week: fallbackWeek(snapshot),
      source: "rules",
      model: generator.model,
    };
  }
}

export async function ensureTrainingPlans(input?: {
  force?: boolean;
  feedback?: string | null;
}): Promise<StoredTrainingPlans | null> {
  const now = new Date();
  let storedFeedback = input?.feedback ?? null;
  try {
    const snapshotInput = await loadTrainingSnapshotInput({
      now,
      feedback: storedFeedback,
    });
    const preview = buildTrainingSnapshot(snapshotInput);
    const existing = await readPlans(preview.localDate, preview.weekStart);
    if (storedFeedback == null) {
      storedFeedback = existing.daily?.feedback ?? null;
    }
    const snapshot = buildTrainingSnapshot({
      ...snapshotInput,
      feedback: storedFeedback,
    });
    const fingerprint = snapshotFingerprint(snapshot);

    if (
      !input?.force &&
      existing.daily &&
      existing.week &&
      existing.daily.fingerprint === fingerprint &&
      existing.week.fingerprint === fingerprint
    ) {
      const today = dailySessionSchema.safeParse(existing.daily.payload);
      const week = weekPlanSchema.safeParse(existing.week.payload);
      if (today.success && week.success) {
        return {
          today: today.data,
          week: week.data,
          source: existing.daily.source as StoredTrainingPlans["source"],
          model: existing.daily.model,
          generatedAt: existing.daily.generated_at,
          feedback: existing.daily.feedback,
        };
      }
    }

    const generated = await generatePlans(snapshot);
    const generatedAt = new Date().toISOString();
    await upsertPlan({
      planType: "daily",
      localDate: snapshot.localDate,
      payload: generated.today,
      ruleCaps: snapshot.allowedKinds,
      fingerprint,
      source: generated.source,
      model: generated.model,
      feedback: storedFeedback,
    });
    await upsertPlan({
      planType: "week",
      localDate: snapshot.weekStart,
      payload: generated.week,
      ruleCaps: snapshot.allowedKinds,
      fingerprint,
      source: generated.source,
      model: generated.model,
      feedback: storedFeedback,
    });
    return {
      ...generated,
      generatedAt,
      feedback: storedFeedback,
    };
  } catch {
    return null;
  }
}

export async function invalidateTrainingPlans() {
  await sql`DELETE FROM training_plans`;
}
