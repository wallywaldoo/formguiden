import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Deliberately a disclosure rather than a headline. GarminDB is a separate
 * open-source tool that a small minority of users already run; the app neither
 * recommends installing it nor depends on it.
 */
export function GarminDbNote() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kör du redan GarminDB?</CardTitle>
        <CardDescription>
          Då kan du släppa din <code>garmin.db</code> här i stället för att
          exportera fil för fil.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p className="text-pretty">
          GarminDB är ett fristående open source-verktyg som körs på din egen
          dator. Formkurvan varken installerar, startar eller ansluter till det
          — vi läser bara databasfilen du själv väljer att ladda upp. Behöver du
          inte GarminDB så behöver du inte bry dig om det här.
        </p>

        <div className="space-y-2">
          <p className="font-medium text-foreground">Detta hämtas</p>
          <p className="text-pretty">
            Sömn, vilopuls, HRV, stress, Body Battery, steg och vikt. Dina pass
            hämtas fortfarande som FIT-filer — aktivitetsdatabasen är för stor
            för att laddas upp.
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-foreground">
            Ladda aldrig upp hela HealthData-mappen
          </p>
          <p className="text-pretty">
            Den innehåller <code>GarminConnectConfig.json</code> med dina
            Garmin-inloggningsuppgifter. Formkurvan tar aldrig emot ditt
            Garmin-lösenord och avvisar uppladdningar som innehåller
            inloggningsuppgifter. Välj enbart filen <code>garmin.db</code>.
          </p>
        </div>

        <details className="group">
          <summary className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline">
            Så tolkar vi filen
          </summary>
          <div className="mt-3 space-y-2 text-pretty">
            <p>
              GarminDB sparar klockslag utan tidszon, så tider läses i tidszonen
              du valt i dina inställningar.
            </p>
            <p>
              Vikt sparas i kilo eller pund beroende på din Garmin-inställning.
              Vi läser vilket system filen använder och räknar om till kilo. Går
              det inte att avgöra avbryter vi importen hellre än gissar — en
              felgissning skulle registrera 70 kg som 32 kg.
            </p>
            <p>
              Du ser alltid en förhandsgranskning innan något sparas, och
              dubbletter skrivs inte över.
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
