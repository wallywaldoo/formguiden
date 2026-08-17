"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  abandonImportAction,
  confirmImportAction,
} from "@/features/imports/actions";

export function ImportConfirmBar({
  importId,
  canConfirm,
  canAbandon,
}: {
  importId: string;
  canConfirm: boolean;
  canAbandon: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await confirmImportAction(importId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function abandon() {
    setBusy(true);
    const result = await abandonImportAction(importId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/import");
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {canConfirm ? (
        <Button onClick={() => void confirm()} disabled={busy}>
          Bekräfta import
        </Button>
      ) : null}
      {canAbandon ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={busy}>
              Avbryt förhandsvisning
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Avbryta importen?</AlertDialogTitle>
              <AlertDialogDescription>
                Förhandsvisningen tas bort. Originalfilerna ligger kvar i ditt
                privata lagringsutrymme.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Behåll</AlertDialogCancel>
              <AlertDialogAction onClick={() => void abandon()}>
                Avbryt import
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
