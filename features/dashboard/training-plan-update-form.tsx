"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { regenerateTrainingPlanAction } from "@/features/training-plan/actions";

export function TrainingPlanUpdateForm({
  placeholder = "Benen är tunga, dålig sömn…",
  title = "Uppdatera rekommendationen",
}: {
  placeholder?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    regenerateTrainingPlanAction,
    {},
  );
  const [wasPending, setWasPending] = useState(false);

  useEffect(() => {
    if (pending) {
      setWasPending(true);
      return;
    }
    if (wasPending && !state?.error) {
      setOpen(false);
    }
    setWasPending(false);
  }, [pending, state, wasPending]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-h-9 rounded-full px-3 text-[0.78rem] shadow-none md:h-7 md:min-h-7 md:px-2.5 md:text-[0.75rem]"
        >
          <Pencil className="size-3.5" />
          Uppdatera
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <Input
            name="feedback"
            placeholder={placeholder}
            maxLength={280}
            aria-label="Notis till coachen"
            autoFocus
            className="h-11 rounded-full border-white/55 bg-white/70 text-base md:h-9 md:text-[0.82rem]"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="shadow-none"
            >
              {pending ? "Uppdaterar…" : "Uppdatera"}
            </Button>
          </div>
          {state?.error ? (
            <p className="text-[0.8rem] text-destructive">{state.error}</p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
