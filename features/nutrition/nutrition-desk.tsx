"use client";

import { useRef, useState, type ReactNode } from "react";

import { CollapsiblePanel } from "@/components/dashboard/collapsible-panel";
import {
  MealSuggestions,
  type MealSuggestion,
} from "@/features/nutrition/meal-suggestions";
import { NutritionForm } from "@/features/nutrition/nutrition-form";

export function NutritionDesk({
  timeZone,
  nowLocal,
  massUnit,
  aiEnabled,
  remainingKcal,
  children,
}: {
  timeZone: string;
  nowLocal: string;
  massUnit: "kg" | "lb";
  aiEnabled: boolean;
  remainingKcal: number | null;
  children?: ReactNode;
}) {
  const [preset, setPreset] = useState<MealSuggestion | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  function selectPreset(meal: MealSuggestion) {
    setPreset(meal);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="px-0.5 text-[0.82rem] font-medium text-muted-foreground">
          Logga mat
        </h2>
        <div ref={formRef} className="surface px-4 py-4 md:px-5">
          <NutritionForm
            key={preset?.id ?? "blank"}
            timeZone={timeZone}
            nowLocal={nowLocal}
            massUnit={massUnit}
            aiEnabled={aiEnabled}
            preset={preset}
          />
        </div>
      </section>

      {children}

      <CollapsiblePanel
        storageKey="fk:collapse:nutrition-suggestions"
        title="Förslag på rätter"
        bodyClassName="px-4 py-4 md:px-5"
      >
        <MealSuggestions
          remainingKcal={remainingKcal}
          selectedId={preset?.id}
          onSelect={selectPreset}
        />
      </CollapsiblePanel>
    </div>
  );
}
