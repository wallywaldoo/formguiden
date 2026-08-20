"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { Apple, Droplets, Dumbbell, Footprints, Scale } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ManualActivityForm } from "@/features/activities/manual-activity-form";
import { WeightForm } from "@/features/body/weight-form";
import { HydrationForm } from "@/features/hydration/hydration-form";
import { NutritionForm } from "@/features/nutrition/nutrition-form";
import { cn } from "@/lib/utils";

function LogTile({
  icon: Icon,
  label,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "surface-tile flex min-h-12 w-full flex-col items-center justify-center gap-1 px-1 py-2.5 transition-colors group-hover/quicklog:bg-primary/6 group-active/quicklog:bg-primary/8 sm:flex-row sm:gap-2 sm:px-3",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="truncate text-[0.68rem] font-medium sm:text-[0.82rem] sm:whitespace-nowrap">
        {label}
      </span>
    </span>
  );
}

const quickLogTriggerClassName =
  "group/quicklog h-auto w-full rounded-xl border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus-visible:ring-2 focus-visible:ring-ring/40 active:translate-y-0";

export function QuickLogActions({
  timeZone,
  nowLocal,
  massUnit,
  volumeUnit,
  distanceUnit,
  aiEnabled,
}: {
  timeZone: string;
  nowLocal: string;
  massUnit: "kg" | "lb";
  volumeUnit: "ml" | "floz";
  distanceUnit: "km" | "mi";
  aiEnabled: boolean;
}) {
  const [activityOpen, setActivityOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [hydrationOpen, setHydrationOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-row flex-nowrap gap-2">
      <div className="min-w-0 flex-1">
        <Dialog open={foodOpen} onOpenChange={setFoodOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className={quickLogTriggerClassName}
              aria-label="Logga mat"
            >
              <LogTile icon={Apple} label="Mat" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Logga mat</DialogTitle>
            </DialogHeader>
            <NutritionForm
              timeZone={timeZone}
              nowLocal={nowLocal}
              massUnit={massUnit}
              aiEnabled={aiEnabled}
              onSuccess={() => setFoodOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="min-w-0 flex-1">
        <Dialog open={hydrationOpen} onOpenChange={setHydrationOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className={quickLogTriggerClassName}
              aria-label="Logga vätska"
            >
              <LogTile icon={Droplets} label="Vätska" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Logga vätska</DialogTitle>
            </DialogHeader>
            <HydrationForm
              timeZone={timeZone}
              nowLocal={nowLocal}
              volumeUnit={volumeUnit}
              onSuccess={() => setHydrationOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="min-w-0 flex-1">
        <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className={quickLogTriggerClassName}
              aria-label="Logga vikt"
            >
              <LogTile icon={Scale} label="Vikt" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Logga vikt</DialogTitle>
            </DialogHeader>
            <WeightForm
              timeZone={timeZone}
              nowLocal={nowLocal}
              massUnit={massUnit}
              onSuccess={() => setWeightOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href="/strength"
          aria-label="Logga styrka"
          className={quickLogTriggerClassName}
        >
          <LogTile icon={Dumbbell} label="Styrka" />
        </Link>
      </div>

      <div className="min-w-0 flex-1">
        <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className={quickLogTriggerClassName}
              aria-label="Logga pass"
            >
              <LogTile icon={Footprints} label="Pass" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Logga pass</DialogTitle>
            </DialogHeader>
            <ManualActivityForm
              timeZone={timeZone}
              nowLocal={nowLocal}
              distanceUnit={distanceUnit}
              onSuccess={() => setActivityOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
