export type NutritionProvenance =
  "manual" | "ai_estimated" | "ai_estimated_edited";

export type MacroSnapshot = {
  energyKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  fiberG: number | null;
};

export function nutritionProvenance(
  requestId: string | null,
  saved: MacroSnapshot,
  estimated: MacroSnapshot | null,
): NutritionProvenance {
  if (!requestId || !estimated) {
    return "manual";
  }
  const same =
    saved.energyKcal === estimated.energyKcal &&
    saved.proteinG === estimated.proteinG &&
    saved.carbohydrateG === estimated.carbohydrateG &&
    saved.fatG === estimated.fatG &&
    saved.fiberG === estimated.fiberG;
  return same ? "ai_estimated" : "ai_estimated_edited";
}
