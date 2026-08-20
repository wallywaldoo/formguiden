import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const rituals = [
  {
    title: "Ett pass",
    time: "FIT-fil",
    body: "Öppna passet i Garmin Connect, exportera Original/FIT och släpp filen här. Bra när ett enskilt pass saknas efter synken.",
  },
  {
    title: "En hel vecka",
    time: "ZIP",
    body: "Flera FIT-filer i en ZIP. Formkurvan känner igen dubbletter, så du kan släppa samma vecka mer än en gång.",
  },
  {
    title: "Historik",
    time: "en gång",
    body: "Första gången: släpp säsongen. Därefter räcker Synca till vardags. Inget skrivs över.",
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
