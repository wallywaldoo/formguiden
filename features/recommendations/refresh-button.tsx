"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { refreshRecommendationAction } from "@/features/recommendations/actions";

export function RefreshRecommendationButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await refreshRecommendationAction();
        });
      }}
    >
      {pending ? "Uppdaterar…" : "Uppdatera"}
    </Button>
  );
}
