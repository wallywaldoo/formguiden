import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
      <h1 className="page-title">Importera</h1>
      <section className="surface-tile space-y-2 px-5 py-5">
        <p className="text-[0.95rem] font-semibold">När ska jag använda den här sidan?</p>
        <p className="text-[0.88rem] leading-6 text-muted-foreground">
          Den vanliga vägen är knappen <span className="font-medium text-foreground">Synca</span> uppe till höger.
          Den hämtar pass och hälsa från Garmin automatiskt. Den här sidan är backupen:
          släpp en FIT-fil, en ZIP med flera pass, eller en extra fil som synken missade.
        </p>
      </section>

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
