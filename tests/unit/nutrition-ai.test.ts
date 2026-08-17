import { describe, expect, it } from "vitest";

import { createNutritionEstimator } from "@/lib/ai/nutrition/create-estimator";
import { DisabledNutritionEstimator } from "@/lib/ai/nutrition/disabled";
import { isOverAiRateLimit } from "@/lib/ai/nutrition/rate-limit";
import { StubNutritionEstimator } from "@/lib/ai/nutrition/stub";
import { NutritionAiDisabledError } from "@/lib/ai/nutrition/types";

describe("nutrition estimator", () => {
  it("defaults to the disabled provider", async () => {
    const estimator = createNutritionEstimator();
    await expect(
      estimator.estimate({
        description: "ägg",
        locale: "sv-SE",
        massUnit: "kg",
      }),
    ).rejects.toBeInstanceOf(NutritionAiDisabledError);
    expect(estimator).toBeInstanceOf(DisabledNutritionEstimator);
  });

  it("returns labelled sample macros from the stub", async () => {
    const estimate = await new StubNutritionEstimator().estimate({
      description: "två ägg och havregrynsgröt",
      locale: "sv-SE",
      massUnit: "kg",
    });
    expect(estimate.provider).toBe("stub");
    expect(
      estimate.assumptions.some((item) => item.includes("Exempeldata")),
    ).toBe(true);
    expect(estimate.energyKcal).toBeGreaterThan(0);
  });

  it("rate-limits after 10 requests in an hour", () => {
    const now = new Date("2026-04-12T12:00:00.000Z");
    const stamps = Array.from({ length: 10 }, () =>
      new Date("2026-04-12T11:30:00.000Z").toISOString(),
    );
    expect(isOverAiRateLimit(stamps, now)).toBe(true);
    expect(isOverAiRateLimit(stamps.slice(0, 9), now)).toBe(false);
  });
});
