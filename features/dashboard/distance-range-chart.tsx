"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DistanceChart } from "@/features/dashboard/charts";

type Series = Array<{ date: string; distanceKm: number }>;

export function DistanceRangeChart({
  series,
}: {
  series: { "7": Series; "28": Series; "90": Series; all: Series };
}) {
  const [range, setRange] = useState<"7" | "28" | "90" | "all">("28");

  return (
    <Tabs
      value={range}
      onValueChange={(value) => setRange(value as "7" | "28" | "90" | "all")}
    >
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="7" className="min-h-10">
          7d
        </TabsTrigger>
        <TabsTrigger value="28" className="min-h-10">
          28d
        </TabsTrigger>
        <TabsTrigger value="90" className="min-h-10">
          90d
        </TabsTrigger>
        <TabsTrigger value="all" className="min-h-10">
          Alla
        </TabsTrigger>
      </TabsList>
      <TabsContent value={range} className="mt-4">
        <DistanceChart data={series[range]} />
      </TabsContent>
    </Tabs>
  );
}
