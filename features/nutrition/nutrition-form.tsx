"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createNutritionEntryAction,
  estimateNutritionAction,
} from "@/features/nutrition/actions";
import { MEAL_TYPE_LABEL } from "@/features/logging/labels";
import type { MealSuggestion } from "@/features/nutrition/meal-suggestions";

export function NutritionForm({
  timeZone,
  nowLocal,
  massUnit,
  aiEnabled,
  onSuccess,
  preset,
}: {
  timeZone: string;
  nowLocal: string;
  massUnit: "kg" | "lb";
  aiEnabled: boolean;
  onSuccess?: () => void;
  preset?: MealSuggestion | null;
}) {
  const [saveState, saveAction] = useActionState(
    createNutritionEntryAction,
    {},
  );
  const [estimateState, estimateAction] = useActionState(
    estimateNutritionAction,
    {},
  );
  const [showMacros, setShowMacros] = useState(preset != null);
  const [energy, setEnergy] = useState(
    preset ? String(preset.energyKcal) : "",
  );
  const [protein, setProtein] = useState(
    preset ? String(preset.proteinG) : "",
  );
  const [carbs, setCarbs] = useState(
    preset ? String(preset.carbohydrateG) : "",
  );
  const [fat, setFat] = useState(preset ? String(preset.fatG) : "");
  const [fiber, setFiber] = useState(preset ? String(preset.fiberG) : "");
  const [appliedRequestId, setAppliedRequestId] = useState<string | null>(null);

  if (
    estimateState.requestId &&
    estimateState.estimate &&
    estimateState.requestId !== appliedRequestId
  ) {
    const estimate = estimateState.estimate;
    setAppliedRequestId(estimateState.requestId);
    setShowMacros(true);
    setEnergy(String(estimate.energyKcal));
    setProtein(String(estimate.proteinG));
    setCarbs(String(estimate.carbohydrateG));
    setFat(String(estimate.fatG));
    setFiber(estimate.fiberG != null ? String(estimate.fiberG) : "");
  }

  useEffect(() => {
    if (saveState.ok) {
      toast.success("Måltid sparad");
      onSuccess?.();
    }
  }, [onSuccess, saveState]);

  return (
    <form action={saveAction} className="flex flex-col gap-6">
      {saveState.error ? (
        <Alert variant="destructive">
          <AlertDescription>{saveState.error}</AlertDescription>
        </Alert>
      ) : null}
      {estimateState.error ? (
        <Alert>
          <AlertDescription>{estimateState.error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="timeZone" value={timeZone} />
      <input type="hidden" name="locale" value="sv-SE" />
      <input type="hidden" name="massUnit" value={massUnit} />
      <input
        type="hidden"
        name="aiEstimationRequestId"
        value={estimateState.requestId ?? ""}
      />
      <input
        type="hidden"
        name="estimatedEnergyKcal"
        value={
          estimateState.estimate
            ? String(estimateState.estimate.energyKcal)
            : ""
        }
      />
      <input
        type="hidden"
        name="estimatedProteinG"
        value={
          estimateState.estimate ? String(estimateState.estimate.proteinG) : ""
        }
      />
      <input
        type="hidden"
        name="estimatedCarbohydrateG"
        value={
          estimateState.estimate
            ? String(estimateState.estimate.carbohydrateG)
            : ""
        }
      />
      <input
        type="hidden"
        name="estimatedFatG"
        value={
          estimateState.estimate ? String(estimateState.estimate.fatG) : ""
        }
      />
      <input
        type="hidden"
        name="estimatedFiberG"
        value={
          estimateState.estimate?.fiberG != null
            ? String(estimateState.estimate.fiberG)
            : ""
        }
      />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="description">Beskrivning</FieldLabel>
          <Textarea
            id="description"
            name="description"
            required
            maxLength={2000}
            rows={3}
            placeholder="Havregrynsgröt, banan och kaffe"
            defaultValue={preset?.description ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="mealType">Måltid</FieldLabel>
          <NativeSelect
            id="mealType"
            name="mealType"
            defaultValue={preset?.mealType ?? "breakfast"}
          >
            {Object.entries(MEAL_TYPE_LABEL).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="eatenAtLocal">Tid</FieldLabel>
          <Input
            id="eatenAtLocal"
            name="eatenAtLocal"
            type="datetime-local"
            defaultValue={nowLocal}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Anteckning</FieldLabel>
          <Input id="notes" name="notes" maxLength={2000} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor="showMacros">Ange kalorier och makro</FieldLabel>
          <Switch
            id="showMacros"
            checked={showMacros}
            onCheckedChange={setShowMacros}
          />
        </div>
        {showMacros ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="energyKcal">kcal</FieldLabel>
              <Input
                id="energyKcal"
                name="energyKcal"
                inputMode="decimal"
                value={energy}
                onChange={(event) => setEnergy(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="proteinG">Protein (g)</FieldLabel>
              <Input
                id="proteinG"
                name="proteinG"
                inputMode="decimal"
                value={protein}
                onChange={(event) => setProtein(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="carbohydrateG">Kolhydrat (g)</FieldLabel>
              <Input
                id="carbohydrateG"
                name="carbohydrateG"
                inputMode="decimal"
                value={carbs}
                onChange={(event) => setCarbs(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="fatG">Fett (g)</FieldLabel>
              <Input
                id="fatG"
                name="fatG"
                inputMode="decimal"
                value={fat}
                onChange={(event) => setFat(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="fiberG">Fiber (g)</FieldLabel>
              <Input
                id="fiberG"
                name="fiberG"
                inputMode="decimal"
                value={fiber}
                onChange={(event) => setFiber(event.target.value)}
              />
            </Field>
          </div>
        ) : null}
        {estimateState.estimate ? (
          <Alert>
            <AlertDescription>
              Detta är en uppskattning baserad på din beskrivning, inte en
              laboratoriemätning eller kostråd.
              {estimateState.estimate.assumptions.length > 0 ? (
                <ul className="mt-2 list-disc pl-4">
                  {estimateState.estimate.assumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <Field>
          <Button
            type="submit"
            variant="outline"
            formAction={estimateAction}
            disabled={!aiEnabled}
          >
            Uppskatta med AI
          </Button>
          <FieldDescription>
            {aiEnabled
              ? "Valfritt. Du kan ändra alla tal innan du sparar."
              : "Avstängt tills en leverantör och kostnad godkänns. Det är inte kostråd."}
          </FieldDescription>
        </Field>
      </FieldGroup>
      <SubmitButton>Spara måltid</SubmitButton>
    </form>
  );
}
