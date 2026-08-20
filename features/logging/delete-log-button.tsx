"use client";

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

export function DeleteLogButton({
  action,
  id,
  sessionId,
  label,
  description,
}: {
  action: (formData: FormData) => Promise<{ error?: string }>;
  id: string;
  sessionId?: string;
  label: string;
  description: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="min-h-11 md:min-h-8">
          Ta bort
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form
          action={async (formData) => {
            await action(formData);
          }}
        >
          <input type="hidden" name="id" value={id} />
          {sessionId ? (
            <input type="hidden" name="sessionId" value={sessionId} />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction type="submit">Ta bort</AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
