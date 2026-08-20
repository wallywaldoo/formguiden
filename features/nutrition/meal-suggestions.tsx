"use client";

import { MEAL_TYPE_LABEL } from "@/features/logging/labels";
import { cn } from "@/lib/utils";

export type MealSuggestion = {
  id: string;
  title: string;
  description: string;
  mealType: keyof typeof MEAL_TYPE_LABEL;
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number;
  tag: string;
};

export const MEAL_SUGGESTIONS: MealSuggestion[] = [
  {
    id: "porridge",
    title: "Havregrynsgröt",
    description: "Gröt, banan, jordnötssmör och kaffe",
    mealType: "breakfast",
    energyKcal: 520,
    proteinG: 18,
    carbohydrateG: 68,
    fatG: 18,
    fiberG: 9,
    tag: "Frukost",
  },
  {
    id: "skyr",
    title: "Skyrbowl",
    description: "Skyr, bär, granola och honung",
    mealType: "breakfast",
    energyKcal: 410,
    proteinG: 32,
    carbohydrateG: 48,
    fatG: 8,
    fiberG: 6,
    tag: "Protein",
  },
  {
    id: "salmon",
    title: "Lax och ris",
    description: "Ugnslax, jasminris och broccoli",
    mealType: "lunch",
    energyKcal: 680,
    proteinG: 42,
    carbohydrateG: 62,
    fatG: 24,
    fiberG: 7,
    tag: "Lunch",
  },
  {
    id: "chicken-pasta",
    title: "Kycklingpasta",
    description: "Pasta, kyckling, tomat och parmesan",
    mealType: "lunch",
    energyKcal: 740,
    proteinG: 46,
    carbohydrateG: 82,
    fatG: 18,
    fiberG: 5,
    tag: "Efter pass",
  },
  {
    id: "omelette",
    title: "Omelett",
    description: "Ägg, spenat, fetaost och rågbröd",
    mealType: "lunch",
    energyKcal: 490,
    proteinG: 34,
    carbohydrateG: 22,
    fatG: 28,
    fiberG: 4,
    tag: "Snabbt",
  },
  {
    id: "tacos",
    title: "Köttfärstacos",
    description: "Tacos, nötkött, salsa och yoghurt",
    mealType: "dinner",
    energyKcal: 720,
    proteinG: 38,
    carbohydrateG: 58,
    fatG: 32,
    fiberG: 8,
    tag: "Middag",
  },
  {
    id: "cod",
    title: "Torsk och potatis",
    description: "Ugnstorsk, potatis och ärtor",
    mealType: "dinner",
    energyKcal: 560,
    proteinG: 44,
    carbohydrateG: 52,
    fatG: 12,
    fiberG: 6,
    tag: "Lätt",
  },
  {
    id: "shake",
    title: "Återhämtningsshake",
    description: "Mjölk, whey, banan och kakao",
    mealType: "snack",
    energyKcal: 380,
    proteinG: 32,
    carbohydrateG: 42,
    fatG: 8,
    fiberG: 3,
    tag: "Mellanmål",
  },
];

export function MealSuggestions({
  remainingKcal,
  selectedId,
  onSelect,
}: {
  remainingKcal: number | null;
  selectedId?: string | null;
  onSelect: (meal: MealSuggestion) => void;
}) {
  const ranked = [...MEAL_SUGGESTIONS].sort((a, b) => {
    if (remainingKcal == null) return 0;
    return (
      Math.abs(a.energyKcal - remainingKcal) -
      Math.abs(b.energyKcal - remainingKcal)
    );
  });

  return (
    <div className="space-y-3">
      <p className="text-[0.75rem] text-muted-foreground">
        {remainingKcal != null
          ? `Klicka för att fylla i formuläret. Cirka ${Math.round(remainingKcal)} kcal kvar idag.`
          : "Klicka för att fylla i formuläret med kalorier och makro."}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ranked.slice(0, 6).map((meal) => {
          const selected = meal.id === selectedId;
          return (
            <button
              key={meal.id}
              type="button"
              onClick={() => onSelect(meal)}
              className={cn(
                "surface-tile px-3.5 py-3 text-left transition-colors hover:bg-white/70",
                selected && "ring-1 ring-primary/25 bg-primary/6",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[0.92rem] font-semibold">{meal.title}</p>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                  {meal.tag}
                </span>
              </div>
              <p className="mt-1 text-[0.75rem] text-muted-foreground">
                {meal.description}
              </p>
              <p className="mt-2 text-[0.75rem] tabular-nums text-muted-foreground">
                {meal.energyKcal} kcal · {meal.proteinG}g protein
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
