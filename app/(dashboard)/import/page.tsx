import Link from "next/link";

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
import { ImportUploader } from "@/features/imports/import-uploader";
import { IMPORT_STATUS_LABEL } from "@/features/imports/labels";
import { graphqlRequest } from "@/lib/graphql/client";
import { LIST_IMPORTS } from "@/lib/graphql/queries/imports";

export default async function ImportPage() {
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
    const data = await graphqlRequest<{ data_imports: typeof imports }>(
      LIST_IMPORTS,
    );
    imports = data.data_imports;
  } catch {
    imports = [];
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Import</h1>
        <p className="text-muted-foreground">
          Ladda upp filer du själv exporterat från Garmin Connect. Det finns
          ingen “Connect Garmin”-knapp.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ny import</CardTitle>
          <CardDescription>
            I Garmin Connect: öppna aktiviteten → exportera Original/FIT, TCX
            eller GPX. ZIP med flera filer går bra inom gränserna.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportUploader />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historik</CardTitle>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga importer ännu.</p>
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
                      {item.committed_count} sparade · {item.duplicate_count}{" "}
                      dubbletter · {item.failed_count} fel
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
