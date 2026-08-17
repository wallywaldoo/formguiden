"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateActivityNotesAction } from "@/features/activities/actions";

export function ActivityNotesForm({
  activityId,
  notes,
}: {
  activityId: string;
  notes: string | null;
}) {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      return updateActivityNotesAction(formData);
    },
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={activityId} />
      <Label htmlFor="notes">Anteckning</Label>
      <Textarea
        id="notes"
        name="notes"
        defaultValue={notes ?? ""}
        maxLength={2000}
        rows={4}
      />
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sparar…" : "Spara anteckning"}
      </Button>
    </form>
  );
}
