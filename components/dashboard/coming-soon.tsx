import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoonPage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Inte i den här fasen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{body}</p>
        </CardContent>
      </Card>
    </div>
  );
}
