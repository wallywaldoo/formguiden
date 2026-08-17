import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CONFIDENCE_LABELS,
  SIGNAL_LABELS,
} from "@/features/recommendations/labels";
import { RefreshRecommendationButton } from "@/features/recommendations/refresh-button";
import { disclaimerText } from "@/lib/recommendations/disclaimers";
import { formulaLabels } from "@/lib/recommendations/formulas";
import type { StoredRecommendation } from "@/lib/recommendations/types";
import { formatPercent } from "@/lib/units/format";

function formatSignalValue(value: number | null, unit: string | null): string {
  if (value == null) {
    return "—";
  }
  if (unit === "h") {
    return `${value.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} h`;
  }
  if (unit === "m") {
    return `${(value / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km`;
  }
  if (unit === "s/km") {
    return `${Math.round(value)} s/km`;
  }
  if (unit === "ratio") {
    return formatPercent(value);
  }
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export function RecommendationCard({
  recommendation,
  showRefresh = true,
}: {
  recommendation: StoredRecommendation;
  showRefresh?: boolean;
}) {
  const formulas = formulaLabels(recommendation.formulaKeys);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardDescription>Rekommendation</CardDescription>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {CONFIDENCE_LABELS[recommendation.confidence] ??
                recommendation.confidence}
            </Badge>
            {showRefresh ? <RefreshRecommendationButton /> : null}
          </div>
        </div>
        <CardTitle className="text-2xl">{recommendation.actionSv}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Jämförelseperiod: {recommendation.comparisonPeriodDays} dagar.
          Datatäckning: {formatPercent(recommendation.completeness)}. Giltig
          till{" "}
          {recommendation.validUntil
            ? new Date(recommendation.validUntil).toLocaleString("sv-SE")
            : "—"}
          .
        </p>

        {recommendation.signals.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {recommendation.signals.map((signal) => (
              <li
                key={signal.signalKey}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-3 py-2"
              >
                <span className="text-muted-foreground">
                  {SIGNAL_LABELS[signal.signalKey] ?? signal.signalKey}
                </span>
                <span className="font-medium tabular-nums">
                  {formatSignalValue(signal.observedValue, signal.unit)}
                  {signal.referenceValue != null && signal.comparator
                    ? ` (${signal.comparator} ${formatSignalValue(signal.referenceValue, signal.unit)})`
                    : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {disclaimerText(recommendation.disclaimerKey)}
        </p>

        <details className="rounded-md border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Varför?</summary>
          <div className="mt-3 space-y-2 text-muted-foreground">
            <p>
              Regel: <code className="text-xs">{recommendation.ruleId}</code>
            </p>
            {formulas.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {formulas.map((formula) => (
                  <li key={formula}>{formula}</li>
                ))}
              </ul>
            ) : (
              <p>Formler dokumenteras per regel i testerna.</p>
            )}
          </div>
        </details>

        <Button asChild variant="outline">
          <Link href={recommendation.href}>Gå till åtgärd</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
