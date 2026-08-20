import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  GarminActivityPayload,
  GarminHrZone,
} from "@/lib/garmin/payload";
import { paceFromSpeedMps } from "@/lib/garmin/payload";
import { formatDistanceKm, formatElevation } from "@/lib/units/format";
import { formatDurationHms, formatPaceMinPerKm } from "@/lib/units/pace";

const HR_ZONE_LABELS = [
  "Z1 Återhämtning",
  "Z2 Grund",
  "Z3 Tempo",
  "Z4 Tröskel",
  "Z5 Max",
];

const HR_ZONE_COLORS = [
  "#7dd3fc",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#f43f5e",
];

function teLabel(value: number | null): string {
  if (value == null) return "—";
  if (value < 1) return `${value.toFixed(1)} · Återhämtning`;
  if (value < 2) return `${value.toFixed(1)} · Underhåll`;
  if (value < 3) return `${value.toFixed(1)} · Förbättring`;
  if (value < 4) return `${value.toFixed(1)} · Hög förbättring`;
  return `${value.toFixed(1)} · Överbelastning`;
}

export function ActivityHeroStats({
  distanceM,
  durationS,
  paceSPerKm,
  avgHeartRateBpm,
  distanceUnit,
}: {
  distanceM: number | null;
  durationS: number | null;
  paceSPerKm: number | null;
  avgHeartRateBpm: number | null;
  distanceUnit: "km" | "mi";
}) {
  const items = [
    {
      label: "Distans",
      value: distanceM != null ? formatDistanceKm(distanceM, distanceUnit) : "—",
    },
    {
      label: "Tid",
      value: durationS != null ? formatDurationHms(durationS) : "—",
    },
    {
      label: "Tempo",
      value: paceSPerKm != null ? `${formatPaceMinPerKm(paceSPerKm)} /km` : "—",
    },
    {
      label: "Medelpuls",
      value: avgHeartRateBpm != null ? `${Math.round(avgHeartRateBpm)} bpm` : "—",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="glass-panel-soft border-white/50">
          <CardHeader className="gap-2">
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-[1.85rem] tracking-[-0.04em]">
              {item.value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function ActivityStatGrid({
  payload,
  durationS,
  maxHeartRateBpm,
  avgCadence,
  caloriesKcal,
  elevationGainM,
  elevationLossM,
  distanceUnit,
  elevationUnit,
}: {
  payload: GarminActivityPayload | null;
  durationS: number | null;
  maxHeartRateBpm: number | null;
  avgCadence: number | null;
  caloriesKcal: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  distanceUnit: "km" | "mi";
  elevationUnit: "m" | "ft";
}) {
  const groups = [
    {
      title: "Tid",
      rows: [
        ["Förflyttning", formatMaybeDuration(payload?.movingDurationS ?? durationS)],
        ["Total tid", formatMaybeDuration(payload?.elapsedDurationS ?? durationS)],
      ],
    },
    {
      title: "Tempo",
      rows: [
        [
          "Medel",
          formatMaybePace(paceFromSpeedMps(payload?.avgSpeedMps ?? null)),
        ],
        [
          "Max",
          formatMaybePace(paceFromSpeedMps(payload?.maxSpeedMps ?? null)),
        ],
      ],
    },
    {
      title: "Puls",
      rows: [
        ["Max", formatBpm(maxHeartRateBpm)],
        ["Min", formatBpm(payload?.minHeartRateBpm ?? null)],
      ],
    },
    {
      title: "Löpning",
      rows: [
        ["Kadens", formatCount(avgCadence, " spm")],
        ["Max kadens", formatCount(payload?.maxCadence ?? null, " spm")],
        [
          "Steglängd",
          payload?.avgStrideLengthCm != null
            ? `${Math.round(payload.avgStrideLengthCm)} cm`
            : "—",
        ],
        ["Steg", formatCount(payload?.steps ?? null)],
      ],
    },
    {
      title: "Höjd",
      rows: [
        [
          "Stigning",
          elevationGainM != null
            ? formatElevation(elevationGainM, elevationUnit)
            : "—",
        ],
        [
          "Nedstigning",
          elevationLossM != null
            ? formatElevation(elevationLossM, elevationUnit)
            : "—",
        ],
        [
          "Högsta",
          payload?.maxElevationM != null
            ? formatElevation(payload.maxElevationM, elevationUnit)
            : "—",
        ],
        [
          "Lägsta",
          payload?.minElevationM != null
            ? formatElevation(payload.minElevationM, elevationUnit)
            : "—",
        ],
      ],
    },
    {
      title: "Belastning",
      rows: [
        [
          "Kalorier",
          caloriesKcal != null ? `${Math.round(caloriesKcal)} kcal` : "—",
        ],
        ["Aerob TE", teLabel(payload?.trainingEffect ?? null)],
        ["Anaerob TE", teLabel(payload?.anaerobicTrainingEffect ?? null)],
        [
          "Intensitet",
          formatIntensity(
            payload?.moderateIntensityMinutes ?? null,
            payload?.vigorousIntensityMinutes ?? null,
          ),
        ],
      ],
    },
  ];

  void distanceUnit;

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <Card key={group.title} className="glass-panel-soft border-white/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-[1.02rem]">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0 text-sm">
            {group.rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tracking-[-0.02em]">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ActivityHrZones({ zones }: { zones: GarminHrZone[] }) {
  if (zones.length === 0) return null;
  const total = zones.reduce((sum, zone) => sum + zone.secsInZone, 0);
  if (total <= 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pulszoner</CardTitle>
        <CardDescription>Tid i varje zon under passet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-3 overflow-hidden rounded-full">
          {zones.map((zone) => (
            <div
              key={zone.zoneNumber}
              className="h-full"
              style={{
                width: `${(zone.secsInZone / total) * 100}%`,
                backgroundColor:
                  HR_ZONE_COLORS[zone.zoneNumber - 1] ?? HR_ZONE_COLORS[4],
              }}
            />
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {zones.map((zone) => (
            <div key={zone.zoneNumber} className="rounded-2xl border border-white/50 px-3 py-2">
              <p className="text-[0.78rem] text-muted-foreground">
                {HR_ZONE_LABELS[zone.zoneNumber - 1] ?? `Z${zone.zoneNumber}`}
                {zone.zoneLowBoundary != null ? ` · ${zone.zoneLowBoundary}+` : ""}
              </p>
              <p className="mt-1 text-[0.98rem] font-semibold">
                {formatDurationHms(Math.round(zone.secsInZone))}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivityWeatherCard({
  weather,
}: {
  weather: GarminActivityPayload["weather"];
}) {
  if (!weather) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Väder</CardTitle>
        <CardDescription>
          {weather.stationName ?? "Från Garmin Connect"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <WeatherCell
          label="Temperatur"
          value={
            weather.temperatureC != null
              ? `${weather.temperatureC.toLocaleString("sv-SE", {
                  maximumFractionDigits: 1,
                })} °C`
              : "—"
          }
        />
        <WeatherCell
          label="Känns som"
          value={
            weather.apparentTemperatureC != null
              ? `${weather.apparentTemperatureC.toLocaleString("sv-SE", {
                  maximumFractionDigits: 1,
                })} °C`
              : "—"
          }
        />
        <WeatherCell
          label="Vind"
          value={
            weather.windSpeed != null
              ? `${weather.windSpeed} ${weather.windSpeedUnit ?? "km/h"}${
                  weather.windDirectionCompass
                    ? ` ${weather.windDirectionCompass.toUpperCase()}`
                    : ""
                }`
              : "—"
          }
        />
        <WeatherCell
          label="Luftfuktighet"
          value={
            weather.humidityPercent != null
              ? `${Math.round(weather.humidityPercent)} %`
              : "—"
          }
        />
        {weather.description ? (
          <div className="sm:col-span-2 lg:col-span-4 text-muted-foreground">
            {weather.description}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WeatherCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function formatMaybeDuration(value: number | null): string {
  return value != null ? formatDurationHms(Math.round(value)) : "—";
}

function formatMaybePace(value: number | null): string {
  return value != null ? `${formatPaceMinPerKm(value)} /km` : "—";
}

function formatBpm(value: number | null): string {
  return value != null ? `${Math.round(value)} bpm` : "—";
}

function formatCount(value: number | null, suffix = ""): string {
  return value != null ? `${Math.round(value)}${suffix}` : "—";
}

function formatIntensity(
  moderate: number | null,
  vigorous: number | null,
): string {
  if (moderate == null && vigorous == null) return "—";
  return `${moderate ?? 0} min måttlig · ${vigorous ?? 0} min hög`;
}
