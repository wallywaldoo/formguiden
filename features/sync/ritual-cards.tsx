import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const rituals = [
  {
    title: "Efter passet",
    time: "10 sekunder",
    body: "I Garmin Connect: öppna aktiviteten → exportera Original/FIT. Släpp filen här eller dela den till Formkurvan från telefonen.",
  },
  {
    title: "Söndagsfångst",
    time: "en ZIP",
    body: "Exportera veckans pass i en ZIP. Formkurvan känner igen dubbletter, så du kan släppa samma vecka om och om igen.",
  },
  {
    title: "Historik",
    time: "en gång",
    body: "Första gången: flera FIT-filer eller en ZIP med säsongen. Därefter räcker det med nya pass. Inget skrivs över.",
  },
];

export function RitualCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {rituals.map((ritual, index) => (
        <Card key={ritual.title}>
          <CardHeader>
            <CardDescription>
              {String(index + 1).padStart(2, "0")} · {ritual.time}
            </CardDescription>
            <CardTitle>{ritual.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-pretty">
              {ritual.body}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
