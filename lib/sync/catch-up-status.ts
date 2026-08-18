export const CATCH_UP_FRESH_HOURS = 36;
export const CATCH_UP_DUE_HOURS = 96;

export type CatchUpTone = "empty" | "fresh" | "due" | "stale";

export type CatchUpStatus = {
  tone: CatchUpTone;
  headline: string;
  body: string;
  lastActivityAt: string | null;
  hoursSinceLastActivity: number | null;
};

export function hoursBetween(fromIso: string, now: Date): number {
  return (now.getTime() - new Date(fromIso).getTime()) / 3_600_000;
}

export function computeCatchUpStatus(input: {
  lastActivityAt: string | null;
  now: Date;
}): CatchUpStatus {
  const lastActivityAt = input.lastActivityAt;
  if (!lastActivityAt) {
    return {
      tone: "empty",
      headline: "Kör. Kom hem. Släpp filen.",
      body: "Formkurvan loggar inte in på Garmin. Du exporterar passet, släpper filen, och vi tar bara det som är nytt.",
      lastActivityAt: null,
      hoursSinceLastActivity: null,
    };
  }

  const hoursSinceLastActivity = hoursBetween(lastActivityAt, input.now);

  if (hoursSinceLastActivity <= CATCH_UP_FRESH_HOURS) {
    return {
      tone: "fresh",
      headline: "Klockan är inne.",
      body: "Senaste passet är redan här. Nästa gång du springer: exportera och släpp. Dubbletter hoppas över.",
      lastActivityAt,
      hoursSinceLastActivity,
    };
  }

  if (hoursSinceLastActivity <= CATCH_UP_DUE_HOURS) {
    return {
      tone: "due",
      headline: "Dags att hämta ikapp.",
      body: "Ett eller flera pass saknas troligen. Släpp dagens FIT, eller en ZIP med veckan — Formkurvan tar bara det nya.",
      lastActivityAt,
      hoursSinceLastActivity,
    };
  }

  return {
    tone: "stale",
    headline: "Formkurvan väntar på passen.",
    body: "Det är ett tag sedan senaste filen. Hämta ikapp med en ZIP från Garmin Connect. Inget skrivs över, inget låtsas-OAuth.",
    lastActivityAt,
    hoursSinceLastActivity,
  };
}

export function formatHoursAgo(hours: number | null): string | null {
  if (hours == null || !Number.isFinite(hours) || hours < 0) {
    return null;
  }
  if (hours < 1) {
    return "nyss";
  }
  if (hours < 24) {
    const rounded = Math.round(hours);
    return rounded === 1 ? "för 1 timme sedan" : `för ${rounded} timmar sedan`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? "för 1 dag sedan" : `för ${days} dagar sedan`;
}
