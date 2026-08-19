import { CoachChat } from "@/features/assistant/coach-chat";
import { summarizeCoachSignals } from "@/features/assistant/coach-response";
import { getCoachContextData } from "@/features/assistant/queries";

export default async function CoachPage() {
  let initialSummary =
    "Jag använder din senaste tränings- och återhämtningsdata för att ge ett praktiskt råd på svenska.";

  try {
    const context = await getCoachContextData();
    initialSummary = summarizeCoachSignals({ context });
  } catch {
    initialSummary =
      "Jag kunde inte läsa all data precis nu, men du kan fortfarande ställa en fråga så försöker jag igen.";
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Fråga din coach</h1>
        <p className="max-w-2xl text-muted-foreground">
          Ställ en fråga direkt i Formkurvan och få ett svar baserat på dina
          synkade Garmin-pass, återhämtningssignaler och mål.
        </p>
      </div>

      <CoachChat initialSummary={initialSummary} />
    </div>
  );
}
