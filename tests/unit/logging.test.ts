import { describe, expect, it } from "vitest";

import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/analytics/dates";
import { nutritionProvenance } from "@/lib/nutrition/provenance";
import { massToKg, volumeToMl } from "@/lib/units/convert";
import {
  hydrationEntrySchema,
  nutritionEntrySchema,
} from "@/lib/validation/logging";

describe("datetime local conversion", () => {
  it("round-trips Europe/Stockholm summer time", () => {
    const iso = fromDatetimeLocal("2026-04-12T07:00", "Europe/Stockholm");
    expect(iso).toBe("2026-04-12T05:00:00.000Z");
    expect(toDatetimeLocal(iso, "Europe/Stockholm")).toBe("2026-04-12T07:00");
  });
});

describe("unit conversion", () => {
  it("stores volume in millilitres", () => {
    expect(volumeToMl(8, "floz")).toBeCloseTo(236.588, 2);
    expect(volumeToMl(250, "ml")).toBe(250);
  });

  it("stores mass in kilograms", () => {
    expect(massToKg(154.32, "lb")).toBeCloseTo(70, 1);
  });
});

describe("nutrition provenance", () => {
  it("marks untouched AI numbers as ai_estimated", () => {
    const macros = {
      energyKcal: 400,
      proteinG: 20,
      carbohydrateG: 50,
      fatG: 10,
      fiberG: 4,
    };
    expect(nutritionProvenance("req", macros, macros)).toBe("ai_estimated");
  });

  it("marks edited AI numbers as ai_estimated_edited", () => {
    expect(
      nutritionProvenance(
        "req",
        {
          energyKcal: 500,
          proteinG: 20,
          carbohydrateG: 50,
          fatG: 10,
          fiberG: 4,
        },
        {
          energyKcal: 400,
          proteinG: 20,
          carbohydrateG: 50,
          fatG: 10,
          fiberG: 4,
        },
      ),
    ).toBe("ai_estimated_edited");
  });

  it("uses manual when there is no AI request", () => {
    expect(
      nutritionProvenance(
        null,
        {
          energyKcal: 400,
          proteinG: null,
          carbohydrateG: null,
          fatG: null,
          fiberG: null,
        },
        null,
      ),
    ).toBe("manual");
  });
});

describe("logging validation", () => {
  it("accepts a manual meal without macros", () => {
    const parsed = nutritionEntrySchema.safeParse({
      timeZone: "Europe/Stockholm",
      eatenAtLocal: "2026-04-12T07:00",
      mealType: "breakfast",
      description: "Havregrynsgröt",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects zero hydration volume", () => {
    const parsed = hydrationEntrySchema.safeParse({
      timeZone: "Europe/Stockholm",
      consumedAtLocal: "2026-04-12T07:00",
      volume: "0",
      volumeUnit: "ml",
      beverageType: "water",
    });
    expect(parsed.success).toBe(false);
  });
});
