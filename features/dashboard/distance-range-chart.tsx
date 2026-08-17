"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DistanceChart } from "@/features/dashboard/charts";

type Series = Array<{ date: string; distanceKm: number }>;

export function DistanceRangeChart({
  series,
}: {
  series: { "7": Series; "28": Series; "90": Series };
}) {
  const [range, setRange] = useState<"7" | "28" | "90">("28");

  return (
    <Tabs
      value={range}
      onValueChange={(value) => setRange(value as "7" | "28" | "90")}
    >
      <TabsList>
        <TabsTrigger value="7">7 dagar</TabsTrigger>
        <TabsTrigger value="28">28 dagar</TabsTrigger>
        <TabsTrigger value="90">90 dagar</TabsTrigger>
      </TabsList>
      <TabsContent value={range} className="mt-4">
        <DistanceChart data={series[range]} />
      </TabsContent>
    </Tabs>
  );
}
