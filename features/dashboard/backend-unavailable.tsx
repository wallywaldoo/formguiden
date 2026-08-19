import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type BackendUnavailableProps = {
  reason?: "database" | "configuration";
};

const COPY_BY_REASON = {
  configuration: {
    title: "Konfiguration saknas",
    description:
      "Formkurvan laddar nu data direkt från Postgres. Kontrollera att `POSTGRES_URL` finns i miljön och innehåller en giltig anslutningsadress, och ladda sedan om sidan.",
  },
  database: {
    title: "Kunde inte läsa träningsdatan",
    description:
      "Formkurvan kunde inte nå Postgres just nu. Försök igen om en stund eller kontrollera databasanslutningen om miljön nyligen ändrats.",
  },
} as const;

export function BackendUnavailable({
  reason = "database",
}: BackendUnavailableProps) {
  const copy = COPY_BY_REASON[reason];

  return (
    <Alert className="glass-panel ambient-divider rounded-[1.5rem] border border-white/55 px-5 py-4">
      <AlertTitle className="text-[0.98rem] font-semibold tracking-[-0.02em]">
        {copy.title}
      </AlertTitle>
      <AlertDescription className="mt-1 text-[0.95rem] leading-6">
        {copy.description}
      </AlertDescription>
    </Alert>
  );
}
