import { addDays, isoWeekday } from "@/lib/analytics/dates";
import {
  clampSessionToKinds,
  type DailySession,
  type TrainingSessionKind,
  type WeekPlan,
} from "@/lib/training-plan/schema";
import {
  snapshotFacts,
  type TrainingSnapshot,
} from "@/lib/training-plan/snapshot";

const WEEK_TEMPLATE: TrainingSessionKind[] = [
  "easy_run",
  "quality_run",
  "strength",
  "easy_run",
  "active_recovery",
  "long_run",
  "rest",
];

function sessionForKind(
  kind: TrainingSessionKind,
  localDate: string,
  why: string[],
): DailySession {
  switch (kind) {
    case "easy_run":
      return {
        localDate,
        kind,
        title: "Lätt löpning 45 min",
        durationMin: 45,
        intensity: "Z2 / prattempo",
        steps: [
          "10 min lugn uppvärmning",
          "30 min lätt löpning där du kan prata",
          "5 min nedvarvning",
        ],
        why,
      };
    case "quality_run":
      return {
        localDate,
        kind,
        title: "Kvalitet 8×400 m",
        durationMin: 50,
        intensity: "Kontrollerade intervaller",
        steps: [
          "12 min uppvärmning",
          "8×400 m med 90 s joggvila",
          "10 min nedvarvning",
        ],
        why,
      };
    case "long_run":
      return {
        localDate,
        kind,
        title: "Långpass 75 min",
        durationMin: 75,
        intensity: "Lätt uthållighet",
        steps: [
          "Börja extra lugnt i 15 min",
          "Håll jämnt prattempo resten",
          "Korta av om kroppen stramar",
        ],
        why,
      };
    case "strength":
      return {
        localDate,
        kind,
        title: "Styrka 40 min",
        durationMin: 40,
        intensity: "Helkropp, 2–3 set",
        steps: [
          "Knäböj eller utfall",
          "Höftlyft och tåhävningar",
          "Planka plus en pressövning",
        ],
        why,
      };
    case "active_recovery":
      return {
        localDate,
        kind,
        title: "Aktiv vila 30 min",
        durationMin: 30,
        intensity: "Mycket lätt",
        steps: [
          "Gå, cykla lätt eller yoga",
          "Håll pulsen låg",
          "Avsluta när det känns piggare, inte tröttare",
        ],
        why,
      };
    case "rest":
      return {
        localDate,
        kind,
        title: "Vila",
        durationMin: 0,
        intensity: "Ingen träning",
        steps: [
          "Ingen strukturerad träning",
          "Sov, ät och rör dig vardagligt",
          "Kolla in hur kroppen känns i morgon",
        ],
        why,
      };
  }
}

function templateKindForWeekday(
  snapshot: TrainingSnapshot | null,
  weekday: number,
): TrainingSessionKind {
  let kind = WEEK_TEMPLATE[weekday - 1] ?? "rest";
  if (!snapshot || weekday !== snapshot.weekday) {
    return kind;
  }
  if (snapshot.preferredKind === "strength" && weekday >= 3 && weekday <= 5) {
    kind = "strength";
  }
  if (
    snapshot.preferredKind === "easy_run" &&
    (kind === "quality_run" || kind === "rest")
  ) {
    kind = "easy_run";
  }
  return kind;
}

function pickKind(
  snapshot: TrainingSnapshot,
  weekday: number,
): TrainingSessionKind {
  const kind = templateKindForWeekday(snapshot, weekday);
  if (!snapshot.allowedKinds.includes(kind)) {
    return snapshot.allowedKinds[0] ?? "rest";
  }
  return kind;
}

export function templateSessionForDate(
  localDate: string,
  snapshot?: TrainingSnapshot | null,
): DailySession {
  const kind = templateKindForWeekday(snapshot ?? null, isoWeekday(localDate));
  const why =
    snapshot != null && snapshotFacts(snapshot).length > 0
      ? snapshotFacts(snapshot)
      : ["Ursprunglig dagsplan."];
  return sessionForKind(kind, localDate, why);
}

/** Keep the pre-workout plan when a completed day was rewritten to recovery. */
export function restorePlannedSession(
  day: DailySession | null | undefined,
  localDate: string,
  snapshot?: TrainingSnapshot | null,
): DailySession | null {
  const templated = templateSessionForDate(localDate, snapshot);
  if (day == null || day.title === "Klar för dagen") {
    return templated;
  }
  if (
    (day.kind === "rest" || day.kind === "active_recovery") &&
    templated.kind !== "rest" &&
    templated.kind !== "active_recovery"
  ) {
    return templated;
  }
  return day;
}

export function restorePlannedWeek(
  week: WeekPlan,
  snapshot?: TrainingSnapshot | null,
): WeekPlan {
  return {
    ...week,
    days: week.days.map((day) => {
      const restored = restorePlannedSession(day, day.localDate, snapshot);
      return restored ?? day;
    }),
  };
}

export function doneForToday(snapshot: TrainingSnapshot): DailySession {
  return {
    localDate: snapshot.localDate,
    kind: "rest",
    title: "Klar för dagen",
    durationMin: 0,
    intensity: "Ingen mer träning",
    steps: [
      "Dagens pass är genomfört.",
      "Ingen mer strukturerad träning ikväll.",
      "Morgondagens rekommendation kommer i morgon.",
    ],
    why: [
      snapshot.vetoReason ?? "Du har redan ett pass inne. Låt det sjunka in.",
    ],
  };
}

export function fallbackToday(snapshot: TrainingSnapshot): DailySession {
  if (snapshot.alreadyTrainedToday) {
    return doneForToday(snapshot);
  }
  const why =
    snapshotFacts(snapshot).length > 0
      ? snapshotFacts(snapshot)
      : ["Baserat på din senaste träning och återhämtning."];
  const kind = pickKind(snapshot, snapshot.weekday);
  return sessionForKind(kind, snapshot.localDate, why);
}

export function fallbackWeek(snapshot: TrainingSnapshot): WeekPlan {
  const why =
    snapshotFacts(snapshot).length > 0
      ? snapshotFacts(snapshot)
      : ["Veckoplan utifrån mål och senaste data."];
  const days = WEEK_TEMPLATE.map((_, index) => {
    const localDate = addDays(snapshot.weekStart, index);
    const kind = templateKindForWeekday(snapshot, index + 1);
    return sessionForKind(kind, localDate, why);
  });
  return { weekStart: snapshot.weekStart, days };
}

export function applyTodayCaps(
  session: DailySession,
  snapshot: TrainingSnapshot,
): DailySession {
  if (snapshot.alreadyTrainedToday) {
    return doneForToday(snapshot);
  }
  return clampSessionToKinds(
    session,
    snapshot.allowedKinds,
    fallbackToday(snapshot),
  );
}
