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

  return <CoachChat variant="page" initialSummary={initialSummary} />;
}
