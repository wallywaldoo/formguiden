import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function IntegrationsSettingsPage() {
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
          <CardTitle>Efter passet</CardTitle>
          <CardDescription>
            Den synk som går att göra ärligt idag.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Garmin släpper inte in appar i Connect Developer Program hur som
            helst. Tills dess är ritualen medvetet enkel: exportera, släpp,
            klart. Dubbletter hoppas över så en vecko-ZIP fungerar som catch-up.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Öppna passet i Garmin Connect.</li>
            <li>Exportera Original/FIT, TCX eller GPX.</li>
            <li>
              Släpp filen var som helst i Formkurvan, eller dela den till appen
              från telefonen om du lagt till Formkurvan på hemskärmen.
            </li>
          </ol>
          <Button asChild>
            <Link href="/import">Öppna Efter passet</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automatisk Garmin-koppling</CardTitle>
          <CardDescription>Senare, officiellt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            När Formkurvan är behörig för Garmins officiella API byggs
            bakåtkompatibilitet in i samma adapter som filimporten. Då hämtas
            nya pass utan att du lyfter ett finger — utan inofficiella bibliotek
            och utan att du lämnar ut lösenord.
          </p>
          <p>
            Det finns ingen “Connect Garmin”-knapp här, avsiktligt. En sådan
            knapp utan officiell access vore ett löfte vi inte kan hålla.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
