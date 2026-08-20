"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

function formatDayAxis(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export function CalorieTrendChart({
  data,
  guideKcal,
  guideLabel,
}: {
  data: Array<{ date: string; kcal: number }>;
  guideKcal: number;
  guideLabel: string;
}) {
  const config = {
    kcal: { label: "kcal", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={18}
          interval="preserveStartEnd"
          tickFormatter={formatDayAxis}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(value) => String(Math.round(Number(value)))}
        />
        <ChartTooltip
          labelFormatter={(value) => formatDayAxis(String(value))}
          content={<ChartTooltipContent />}
        />
        <ReferenceLine
          y={guideKcal}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          strokeOpacity={0.7}
          label={{
            value: guideLabel,
            position: "insideTopRight",
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        <Bar dataKey="kcal" fill="var(--color-kcal)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

const MACRO_COLORS = {
  protein: "var(--primary)",
  carbs: "oklch(0.78 0.12 75)",
  fat: "var(--chart-5)",
} as const;

export function MacroDonutChart({
  data,
}: {
  data: Array<{ key: "protein" | "carbs" | "fat"; label: string; grams: number; percent: number }>;
}) {
  const config = {
    protein: { label: "Protein", color: MACRO_COLORS.protein },
    carbs: { label: "Kolhydrater", color: MACRO_COLORS.carbs },
    fat: { label: "Fett", color: MACRO_COLORS.fat },
  } satisfies ChartConfig;

  const chartData = data.map((row) => ({
    name: row.key,
    value: row.grams,
    fill: MACRO_COLORS[row.key],
  }));

  return (
    <div className="space-y-3">
      <ChartContainer config={config} className="mx-auto aspect-square h-48 w-full max-w-[14rem]">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={48}
            outerRadius={72}
            strokeWidth={2}
            stroke="rgba(255,255,255,0.55)"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.78rem] text-muted-foreground">
        {data.map((row) => (
          <li key={row.key} className="flex items-center gap-1.5 tabular-nums">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: MACRO_COLORS[row.key] }}
            />
            {row.label}: {Math.round(row.grams)} g ({row.percent} %)
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HydrationTrendChart({
  data,
  goalMl,
}: {
  data: Array<{ date: string; ml: number }>;
  goalMl: number;
}) {
  const config = {
    ml: { label: "ml", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={18}
          interval="preserveStartEnd"
          tickFormatter={formatDayAxis}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(value) => String(Math.round(Number(value)))}
        />
        <ChartTooltip
          labelFormatter={(value) => formatDayAxis(String(value))}
          content={<ChartTooltipContent />}
        />
        <ReferenceLine
          y={goalMl}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          strokeOpacity={0.7}
          label={{
            value: `Mål ${goalMl} ml`,
            position: "insideTopRight",
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        <Bar dataKey="ml" fill="var(--color-ml)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
