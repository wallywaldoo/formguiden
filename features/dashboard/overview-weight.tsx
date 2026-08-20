"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WeightForm } from "@/features/body/weight-form";
import { weightGoalProgress } from "@/lib/analytics/race-estimates";

function Meter({ ratio }: { ratio: number }) {
  const width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/55">
      <div className="h-full rounded-full bg-foreground/80" style={{ width }} />
    </div>
  );
}

export function OverviewWeight({
  embedded = false,
  currentKg,
  targetKg,
  trendKgPerWeek,
  timeZone,
  nowLocal,
  massUnit,
}: {
  embedded?: boolean;
  currentKg: number | null;
  targetKg: number | null;
  trendKgPerWeek: number | null;
  timeZone: string;
  nowLocal: string;
  massUnit: "kg" | "lb";
}) {
  const [open, setOpen] = useState(false);
  const progress = weightGoalProgress({ currentKg, targetKg });
  const trendLabel =
    trendKgPerWeek != null
      ? `${trendKgPerWeek >= 0 ? "+" : ""}${trendKgPerWeek.toFixed(2)} kg/v`
      : null;

  return (
    <section className={embedded ? "space-y-2" : "space-y-2"}>
      <div className="flex items-center justify-between gap-3 px-0.5">
        {!embedded ? (
          <h2 className="text-[0.82rem] font-medium text-muted-foreground">
            Vikt
          </h2>
        ) : (
          <p className="text-[0.82rem] font-medium text-muted-foreground">
            Vikt
          </p>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-9 min-h-9 rounded-full px-3 text-[0.78rem] shadow-none md:h-7 md:min-h-7 md:px-2.5 md:text-[0.75rem]"
            >
              <Plus className="size-3.5" />
              Logga
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Logga vikt</DialogTitle>
            </DialogHeader>
            <WeightForm
              timeZone={timeZone}
              nowLocal={nowLocal}
              massUnit={massUnit}
              onSuccess={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {progress ? (
        <Link
          href="/body"
          className="surface-soft block px-4 py-3.5 transition-colors hover:bg-white/55"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[1.2rem] font-semibold tabular-nums">
              {progress.currentLabel}
            </p>
            <p className="text-[0.85rem] text-muted-foreground tabular-nums">
              Mål {progress.targetLabel}
            </p>
          </div>
          <p className="mt-1 text-[0.75rem] text-muted-foreground">
            {progress.detail}
            {trendLabel ? ` · ${trendLabel}` : ""}
          </p>
          <Meter ratio={progress.ratio} />
        </Link>
      ) : (
        <div className="surface-soft px-4 py-3.5">
          <p className="text-[1.05rem] font-semibold tabular-nums">
            {currentKg != null
              ? `${currentKg.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} kg`
              : "—"}
          </p>
          <p className="mt-1 text-[0.75rem] text-muted-foreground">
            {targetKg != null ? (
              <>
                Mål{" "}
                {targetKg.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}{" "}
                kg
              </>
            ) : (
              <Link href="/goals" className="underline-offset-4 hover:underline">
                Sätt viktmål
              </Link>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
