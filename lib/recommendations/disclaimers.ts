export const RECOMMENDATION_DISCLAIMERS: Record<string, string> = {
  training_general:
    "Detta är träningsobservationer baserade på dina egna loggar — inte medicinsk rådgivning eller diagnos.",
  recovery_general:
    "Återhämtningssignaler är grova indikatorer. Lyssna på kroppen och sök vård vid sjukdom eller skada.",
};

export function disclaimerText(key: string): string {
  return (
    RECOMMENDATION_DISCLAIMERS[key] ??
    RECOMMENDATION_DISCLAIMERS.training_general
  );
}
