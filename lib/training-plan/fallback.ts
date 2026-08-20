import { addDays } from "@/lib/analytics/dates";
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

function pickKind(
  snapshot: TrainingSnapshot,
  weekday: number,
): TrainingSessionKind {
  let kind = WEEK_TEMPLATE[weekday - 1] ?? "rest";
  if (snapshot.preferredKind === "strength" && weekday >= 3 && weekday <= 5) {
    kind = "strength";
  }
  if (
    snapshot.preferredKind === "easy_run" &&
    (kind === "quality_run" || kind === "rest")
  ) {
    kind = "easy_run";
  }
  if (!snapshot.allowedKinds.includes(kind)) {
    kind = snapshot.allowedKinds[0] ?? "rest";
  }
  return kind;
}

export function fallbackToday(snapshot: TrainingSnapshot): DailySession {
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
  const days = WEEK_TEMPLATE.map((templateKind, index) => {
    const localDate = addDays(snapshot.weekStart, index);
    const isToday = localDate === snapshot.localDate;
    const kind = isToday ? pickKind(snapshot, snapshot.weekday) : templateKind;
    return sessionForKind(kind, localDate, why);
  });
  return { weekStart: snapshot.weekStart, days };
}

export function applyTodayCaps(
  session: DailySession,
  snapshot: TrainingSnapshot,
): DailySession {
  return clampSessionToKinds(
    session,
    snapshot.allowedKinds,
    fallbackToday(snapshot),
  );
}
