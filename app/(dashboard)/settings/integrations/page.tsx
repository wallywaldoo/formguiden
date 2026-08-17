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
          Ingen Garmin Connect-inloggning i den här versionen.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Garmin-filer</CardTitle>
          <CardDescription>Manuell export, ingen OAuth.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Så exporterar du från Garmin Connect i webbläsaren:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Öppna aktiviteten eller den dag du vill spara.</li>
            <li>Välj export till FIT, TCX, GPX eller CSV.</li>
            <li>
              Du kan också ladda ner en ZIP med flera filer. Max 25 MiB per fil.
            </li>
          </ol>
          <p>
            Ladda inte upp filer som innehåller data för någon annan person.
          </p>
          <Button asChild>
            <Link href="/import">Gå till import</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
