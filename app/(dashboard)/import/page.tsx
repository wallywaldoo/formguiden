import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IMPORT_STATUS_LABEL } from "@/features/imports/labels";
import { CatchUpDropzone } from "@/features/sync/catch-up-dropzone";
import { GarminDbNote } from "@/features/sync/garmindb-note";
import { RitualCards } from "@/features/sync/ritual-cards";
import { listImports } from "@/lib/db/queries";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  let imports: Array<{
    id: string;
    status: string;
    file_count: number;
    previewed_count: number;
    committed_count: number;
    failed_count: number;
    duplicate_count: number;
    created_at: string;
    error_summary: string | null;
  }> = [];
  try {
    imports = await listImports();
  } catch {
    imports = [];
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Efter passet
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          Klockan hemma. Formkurvan i telefonen.
        </h1>
        <p className="max-w-2xl text-muted-foreground text-pretty">
          Garmin Connect är källan. Formkurvan är din privata coach. Du
          exporterar, släpper, och vi tar bara det som är nytt — ungefär som
          Strava, utan att be om ditt Garmin-lösenord.
        </p>
      </div>

      {params.error ? (
        <Alert variant="destructive">
          <AlertDescription>{params.error}</AlertDescription>
        </Alert>
      ) : null}

      <CatchUpDropzone />
      <RitualCards />
      <GarminDbNote />

      <Card>
        <CardHeader>
          <CardTitle>Tidigare inhämtningar</CardTitle>
          <CardDescription>
            Varje släpp är en händelse. Dubbletter räknas, inget skrivs över.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inget inne ännu. Första filen är den som startar säsongen.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filer</TableHead>
                  <TableHead>Resultat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={`/import/${item.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {new Date(item.created_at).toLocaleString("sv-SE")}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {IMPORT_STATUS_LABEL[item.status] ?? item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.file_count}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.committed_count} nya · {item.duplicate_count} redan
                      inne · {item.failed_count} fel
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
