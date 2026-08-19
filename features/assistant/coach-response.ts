import { formatDistanceKm, formatHours } from "@/lib/units/format";
import { formatDurationHms, formatPaceMinPerKm } from "@/lib/units/pace";

import type { CoachContextData } from "@/features/assistant/queries";

const RUN_TYPES = new Set(["run", "trail_run", "treadmill"]);

type CoachIntent = "recovery" | "latest-activity" | "today-plan" | "general";

function average(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function median(values: Array<number | null | undefined>): number | null {
  const finite = values
    .filter((value): value is number => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (finite.length === 0) {
    return null;
  }
  const middle = Math.floor(finite.length / 2);
  if (finite.length % 2 === 0) {
    return (finite[middle - 1]! + finite[middle]!) / 2;
  }
  return finite[middle]!;
}

function classifyIntent(message: string): CoachIntent {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("återhämt") ||
    normalized.includes("recovery") ||
    normalized.includes("sömn") ||
    normalized.includes("hrv")
  ) {
    return "recovery";
  }
  if (
    normalized.includes("senaste pass") ||
    normalized.includes("senaste aktivitet") ||
    normalized.includes("hur såg mitt senaste pass ut") ||
    normalized.includes("igår")
  ) {
    return "latest-activity";
  }
  if (
    normalized.includes("träna idag") ||
    normalized.includes("vad bör jag träna idag") ||
    normalized.includes("vad ska jag träna idag") ||
    normalized.includes("idag")
  ) {
    return "today-plan";
  }
  return "general";
}

function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / (60 * 60 * 1000);
}

function formatLatestActivity(context: CoachContextData, now: Date): string | null {
  const latest = context.activities[0];
  if (!latest) {
    return null;
  }

  const distanceUnit = context.preferences?.distanceUnit ?? "km";
  const parts = [
    `Senaste passet var ${new Date(latest.startedAt).toLocaleString("sv-SE")}.`,
  ];

  const details: string[] = [];
  if (latest.distanceM != null) {
    details.push(formatDistanceKm(latest.distanceM, distanceUnit));
  }
  if (latest.durationS != null) {
    details.push(formatDurationHms(latest.durationS));
  }
  if (latest.avgPaceSPerKm != null) {
    details.push(`${formatPaceMinPerKm(latest.avgPaceSPerKm)} /km`);
  }
  if (latest.avgHeartRateBpm != null) {
    details.push(`${Math.round(latest.avgHeartRateBpm)} bpm i snittpuls`);
  }
  if (details.length > 0) {
    parts.push(`Jag ser ${details.join(", ")}.`);
  }

  if (latest.notes?.trim()) {
    parts.push(`Noteringen var "${latest.notes.trim()}".`);
  }

  const ageHours = hoursSince(latest.startedAt, now);
  if (ageHours <= 24) {
    parts.push("Det är alltså fortfarande färskt i kroppen.");
  }

  return parts.join(" ");
}

function summarizeRecovery(context: CoachContextData): {
  text: string;
  caution: boolean;
} {
  const latest = context.health[0];
  if (!latest) {
    return {
      text: "Jag saknar återhämtningsdata just nu, så jag kan inte bedöma sömn, HRV eller stress ännu.",
      caution: true,
    };
  }

  const last7 = context.health.slice(0, 7);
  const baseline = context.health.slice(0, 28);
  const avgSleep = average(last7.map((item) => item.sleepDurationS));
  const avgStress = average(last7.map((item) => item.stressAvg));
  const baselineHrv = median(baseline.map((item) => item.hrvRmssdMs));
  const baselineRhr = median(baseline.map((item) => item.restingHeartRateBpm));
  const hrvDelta =
    latest.hrvRmssdMs != null && baselineHrv != null
      ? latest.hrvRmssdMs - baselineHrv
      : null;
  const rhrDelta =
    latest.restingHeartRateBpm != null && baselineRhr != null
      ? latest.restingHeartRateBpm - baselineRhr
      : null;

  const snippets: string[] = [];
  if (avgSleep != null) {
    snippets.push(`snittsömn senaste veckan är ${formatHours(avgSleep)}`);
  }
  if (latest.hrvRmssdMs != null) {
    snippets.push(`dagens HRV är ${Math.round(latest.hrvRmssdMs)} ms`);
  }
  if (latest.restingHeartRateBpm != null) {
    snippets.push(`vilopulsen är ${Math.round(latest.restingHeartRateBpm)} bpm`);
  }
  if (avgStress != null) {
    snippets.push(`stressnivån ligger runt ${Math.round(avgStress)}`);
  }
  if (latest.bodyBatteryHigh != null) {
    snippets.push(`Body Battery toppade på ${Math.round(latest.bodyBatteryHigh)}`);
  }

  const caution =
    (avgSleep != null && avgSleep < 6.5 * 3600) ||
    (hrvDelta != null && hrvDelta <= -8) ||
    (rhrDelta != null && rhrDelta >= 4) ||
    (avgStress != null && avgStress >= 40) ||
    (latest.bodyBatteryHigh != null && latest.bodyBatteryHigh < 55);

  const recoveryText =
    snippets.length > 0
      ? `Återhämtningen just nu: ${snippets.join(", ")}.`
      : "Jag ser för lite återhämtningsdata för att göra en säker bedömning.";

  if (caution) {
    return {
      text: `${recoveryText} Det lutar åt en lugnare dag med lätt löpning, promenad eller vila i stället för hög intensitet.`,
      caution: true,
    };
  }

  return {
    text: `${recoveryText} Inget i datan skriker röd flagg, så en normal träningsdag är rimlig om benen också känns bra.`,
    caution: false,
  };
}

function summarizeTrainingLoad(context: CoachContextData, now: Date): {
  text: string;
  shouldGoEasy: boolean;
} {
  const runs = context.activities.filter((activity) =>
    RUN_TYPES.has(activity.activityType),
  );
  if (runs.length === 0) {
    return {
      text: "Jag ser inga löppass ännu, så träningsrådet blir försiktigt tills mer data har kommit in.",
      shouldGoEasy: true,
    };
  }

  const last7Runs = runs.filter(
    (activity) => hoursSince(activity.startedAt, now) <= 7 * 24,
  );
  const last7Distance = last7Runs.reduce(
    (sum, activity) => sum + (activity.distanceM ?? 0),
    0,
  );
  const weeklyGoal = context.goal?.weeklyRunDistanceM ?? null;
  const latestRun = runs[0] ?? null;
  const recentHardRun =
    latestRun &&
    hoursSince(latestRun.startedAt, now) <= 36 &&
    ((latestRun.distanceM != null && latestRun.distanceM >= 12_000) ||
      (latestRun.durationS != null && latestRun.durationS >= 75 * 60) ||
      (latestRun.trainingLoad != null && latestRun.trainingLoad >= 140) ||
      (latestRun.avgPaceSPerKm != null &&
        context.goal?.targetPaceSPerKm != null &&
        latestRun.avgPaceSPerKm <= context.goal.targetPaceSPerKm * 1.02));

  const parts: string[] = [];
  parts.push(
    `Du har ungefär ${formatDistanceKm(
      last7Distance,
      context.preferences?.distanceUnit ?? "km",
    )} löpning senaste 7 dagarna.`,
  );
  if (weeklyGoal != null) {
    const gapKm = (last7Distance - weeklyGoal) / 1000;
    parts.push(
      gapKm >= 0
        ? `Det är cirka ${gapKm.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km över veckomålet.`
        : `Det är cirka ${Math.abs(gapKm).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km under veckomålet.`,
    );
  }
  if (recentHardRun) {
    parts.push(
      "Senaste passet ser dessutom tillräckligt belastande ut för att motivera ett lättare upplägg idag.",
    );
  }

  return {
    text: parts.join(" "),
    shouldGoEasy: Boolean(recentHardRun),
  };
}

function planToday(context: CoachContextData, now: Date): string {
  const recovery = summarizeRecovery(context);
  const load = summarizeTrainingLoad(context, now);

  const recommendation = recovery.caution || load.shouldGoEasy;
  if (recommendation) {
    return `${recovery.text} ${load.text} Min rekommendation idag är återhämtning eller ett kort, lätt pass i prattempo. Hoppa över hårda intervaller tills signalerna ser bättre ut.`;
  }

  return `${recovery.text} ${load.text} Min rekommendation idag är ett kontrollerat kvalitetspass eller ett normalt distanspass, beroende på vad som står i din plan. Håll första delen lugn och stäm av känslan innan du trycker på.`;
}

function answerLatestActivity(context: CoachContextData, now: Date): string {
  const latest = formatLatestActivity(context, now);
  if (!latest) {
    return "Jag hittar inget senaste pass ännu. När Garmin-data har synkats in kan jag sammanfatta passet och sätta det i träningssammanhang.";
  }

  const recovery = summarizeRecovery(context);
  return `${latest} ${recovery.caution ? "Återhämtningen efteråt ser lite ansträngd ut, så jag hade hållit nästa pass lugnt." : "Återhämtningen ser inte alarmerande ut, så passet verkar ha landat okej."}`;
}

function answerGeneral(message: string, context: CoachContextData, now: Date): string {
  const latest = formatLatestActivity(context, now);
  const recovery = summarizeRecovery(context);
  const load = summarizeTrainingLoad(context, now);
  const pendingImport = context.pendingImport
    ? " Jag ser också att en import fortfarande bearbetas, så bilden kan bli skarpare när den är klar."
    : "";

  return `Min tolkning av din fråga "${message.trim()}": ${recovery.text} ${load.text} ${latest ?? ""}${pendingImport} Om du vill kan du fråga mer specifikt om återhämtning, senaste passet eller vad du bör träna idag.`
    .replace(/\s+/g, " ")
    .trim();
}

export function generateCoachResponse(input: {
  message: string;
  context: CoachContextData;
  now?: Date;
}): {
  reply: string;
} {
  const now = input.now ?? new Date();
  const message = input.message.trim();

  if (!message) {
    return {
      reply: "Skriv en fråga om återhämtning, senaste passet eller vad du bör träna idag så hjälper jag dig.",
    };
  }

  if (input.context.activities.length === 0 && input.context.health.length === 0) {
    return {
      reply:
        "Jag har för lite Garmin-data i Formkurvan ännu för att ge ett bra råd. Synka aktiviteter eller hälsodata först, så kan jag coacha utifrån riktig belastning och återhämtning.",
    };
  }

  const intent = classifyIntent(message);
  const greeting = input.context.profile?.displayName
    ? `${input.context.profile.displayName}, `
    : "";

  switch (intent) {
    case "recovery":
      return { reply: `${greeting}${summarizeRecovery(input.context).text}` };
    case "latest-activity":
      return { reply: `${greeting}${answerLatestActivity(input.context, now)}` };
    case "today-plan":
      return { reply: `${greeting}${planToday(input.context, now)}` };
    case "general":
    default:
      return { reply: `${greeting}${answerGeneral(message, input.context, now)}` };
  }
}

export function summarizeCoachSignals(input: {
  context: CoachContextData;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  return planToday(input.context, now);
}
