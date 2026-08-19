import Link from "next/link";

import { AutomationTokenForm } from "@/features/automation/token-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import sql from "@/lib/db";

export default async function IntegrationsSettingsPage() {
  const tokens: Array<{
    id: string;
    label: string;
    expires_at: string;
    revoked_at: string | null;
    created_at: string;
  }> = [];

  let lastImport: {
    status: string;
    created_at: string;
    committed_at: string | null;
    committed_count: number;
  } | null = null;

  try {
    const rows = await sql`
      SELECT status, created_at, committed_at, committed_count
      FROM data_imports
      WHERE provider = 'garmin-sync'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    lastImport = (rows[0] as unknown as { status: string; created_at: string; committed_at: string | null; committed_count: number }) ?? null;
  } catch {
    lastImport = null;
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Integrationer</h1>
        <p className="text-muted-foreground">
          Formkurvan kopplar inte in sig i Garmin. Du behåller nycklarna.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lokal Garmin-sync</CardTitle>
          <CardDescription>
            Ett skript på din dator hämtar från Garmin Connect och skickar hit
            datan. Garmin-inloggningen lämnar aldrig maskinen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {lastImport ? (
            <p>
              Senaste körningen:{" "}
              {new Date(
                lastImport.committed_at ?? lastImport.created_at,
              ).toLocaleString("sv-SE")}
              {lastImport.status === "committed"
                ? ` · ${lastImport.committed_count} rader landade`
                : ` · status ${lastImport.status}`}
              . Första körningen stannar på förhandsgranskning tills du
              bekräftar den i Efter passet.
            </p>
          ) : (
            <p>
              Ingen automatisk körning har kommit in än. Skapa en token, sätt
              upp skriptet, och bekräfta första importen för hand.
            </p>
          )}
          <p>
            En token ger hela kontot, inte bara import. Spara den i
            <code>~/.formkurvan/garmin-sync.env</code> och dela den inte.
          </p>
          <AutomationTokenForm tokens={tokens} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Efter passet</CardTitle>
          <CardDescription>
            Manuell filimport, fortfarande den ärliga vägen utan extra maskin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Exportera FIT, TCX, GPX eller en garmin.db och släpp filen här.
            Dubbletter hoppas över.
          </p>
          <Button asChild>
            <Link href="/import">Öppna Efter passet</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
