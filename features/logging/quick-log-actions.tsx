"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WeightForm } from "@/features/body/weight-form";
import { HydrationForm } from "@/features/hydration/hydration-form";
import { NutritionForm } from "@/features/nutrition/nutrition-form";

export function QuickLogActions({
  timeZone,
  nowLocal,
  massUnit,
  volumeUnit,
  aiEnabled,
}: {
  timeZone: string;
  nowLocal: string;
  massUnit: "kg" | "lb";
  volumeUnit: "ml" | "floz";
  aiEnabled: boolean;
}) {
  const [foodOpen, setFoodOpen] = useState(false);
  const [hydrationOpen, setHydrationOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Dialog open={foodOpen} onOpenChange={setFoodOpen}>
        <DialogTrigger asChild>
          <Button className="w-full justify-center shadow-none">Logga mat</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Logga mat</DialogTitle>
            <DialogDescription>
              Fri text. Kalorier är valfria och AI är avstängt tills vidare.
            </DialogDescription>
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

      <Dialog open={hydrationOpen} onOpenChange={setHydrationOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full justify-center shadow-none">
            Logga vätska
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Logga vätska</DialogTitle>
            <DialogDescription>Volym lagras i milliliter.</DialogDescription>
          </DialogHeader>
          <HydrationForm
            timeZone={timeZone}
            nowLocal={nowLocal}
            volumeUnit={volumeUnit}
            onSuccess={() => setHydrationOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full justify-center shadow-none">
            Logga vikt
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Logga vikt</DialogTitle>
            <DialogDescription>
              Manuell mätning, utöver vikt från Garmin-filer.
            </DialogDescription>
          </DialogHeader>
          <WeightForm
            timeZone={timeZone}
            nowLocal={nowLocal}
            massUnit={massUnit}
            onSuccess={() => setWeightOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Button
        variant="outline"
        asChild
        className="w-full justify-center shadow-none"
      >
        <Link href="/strength">Logga styrka</Link>
      </Button>
    </div>
  );
}
