import { derivedPace, toIso } from "@/lib/import/normalize";
import type {
  CanonicalActivity,
  CanonicalBodyMeasurement,
  ParseResult,
} from "@/lib/import/types";

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function parseDuration(value: string): number | null {
  const parts = value.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts as [number, number, number];
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts as [number, number];
    return minutes * 60 + seconds;
  }
  return null;
}

function parseDistanceMeters(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  if (value.toLowerCase().includes("mi")) {
    return parsed * 1609.344;
  }
  if (parsed > 200 && !value.toLowerCase().includes("km")) {
    return parsed;
  }
  return parsed * 1000;
}

function mapActivityType(value: string): CanonicalActivity["activityType"] {
  const sport = value.toLowerCase();
  if (sport.includes("trail")) {
    return "trail_run";
  }
  if (sport.includes("treadmill")) {
    return "treadmill";
  }
  if (sport.includes("run")) {
    return "run";
  }
  if (sport.includes("walk")) {
    return "walk";
  }
  if (sport.includes("hik")) {
    return "hike";
  }
  if (sport.includes("cycl") || sport.includes("bik")) {
    return "cycle";
  }
  if (sport.includes("strength")) {
    return "strength";
  }
  return "other";
}

function findHeader(headers: string[], aliases: string[]): number {
  const normalized = headers.map((header) => header.toLowerCase());
  for (const alias of aliases) {
    const index = normalized.findIndex((header) => header.includes(alias));
    if (index >= 0) {
      return index;
    }
  }
  return -1;
}

export function parseCsv(bytes: Uint8Array): ParseResult {
  const text = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes)
    .replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return {
      activities: [],
      dailyHealth: [],
      bodyMeasurements: [],
      warnings: [{ code: "empty_csv", message: "CSV-filen saknar rader." }],
    };
  }

  const delimiter =
    (lines[0]?.split(";").length ?? 0) > (lines[0]?.split(",").length ?? 0)
      ? ";"
      : ",";
  const headers = splitCsvLine(lines[0] ?? "", delimiter);
  const typeIndex = findHeader(headers, ["activity type", "typ", "sport"]);
  const dateIndex = findHeader(headers, ["date", "datum", "start"]);
  const distanceIndex = findHeader(headers, ["distance", "distans"]);
  const timeIndex = findHeader(headers, ["time", "duration", "tid"]);
  const caloriesIndex = findHeader(headers, ["calories", "kalorier"]);
  const hrIndex = findHeader(headers, ["avg hr", "avg heart", "medelpuls"]);
  const titleIndex = findHeader(headers, ["title", "titel"]);
  const weightIndex = findHeader(headers, ["weight", "vikt", "mass"]);

  const activities: CanonicalActivity[] = [];
  const bodyMeasurements: CanonicalBodyMeasurement[] = [];
  const warnings: ParseResult["warnings"] = [];

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line, delimiter);
    const startedAt = toIso(dateIndex >= 0 ? cols[dateIndex] : null);
    const weightRaw = weightIndex >= 0 ? cols[weightIndex] : "";
    const weight = weightRaw
      ? Number.parseFloat(weightRaw.replace(",", "."))
      : NaN;

    if (startedAt && Number.isFinite(weight) && weight > 0 && typeIndex < 0) {
      bodyMeasurements.push({
        externalId: `garmin-file:csv-weight:${startedAt}`,
        measuredAt: startedAt,
        massKg: weight > 200 ? weight / 1000 : weight,
        bodyFatPct: null,
      });
      continue;
    }

    if (!startedAt) {
      continue;
    }

    const durationS =
      timeIndex >= 0 ? parseDuration(cols[timeIndex] ?? "") : null;
    const distanceM =
      distanceIndex >= 0
        ? parseDistanceMeters(cols[distanceIndex] ?? "")
        : null;
    const hr = hrIndex >= 0 ? Number.parseFloat(cols[hrIndex] ?? "") : NaN;
    const calories =
      caloriesIndex >= 0 ? Number.parseFloat(cols[caloriesIndex] ?? "") : NaN;

    activities.push({
      externalId: `garmin-file:csv:${startedAt}:${cols[titleIndex] ?? ""}`,
      activityType: mapActivityType(
        typeIndex >= 0 ? (cols[typeIndex] ?? "") : "run",
      ),
      startedAt,
      endedAt: null,
      durationS,
      durationKind: "elapsed",
      distanceM,
      elevationGainM: null,
      elevationLossM: null,
      avgPaceSPerKm: derivedPace(distanceM, durationS),
      avgHeartRateBpm: Number.isFinite(hr) ? hr : null,
      maxHeartRateBpm: null,
      avgCadence: null,
      caloriesKcal: Number.isFinite(calories) ? calories : null,
      trainingLoad: null,
      notes: titleIndex >= 0 ? (cols[titleIndex] ?? null) : null,
      laps: [],
    });
  }

  if (activities.length === 0 && bodyMeasurements.length === 0) {
    warnings.push({
      code: "csv_unmapped",
      message:
        "CSV-kolumnerna kändes inte igen. Använd Garmin aktivitetslista eller en fil med Date, Distance och Time.",
    });
  }

  return { activities, dailyHealth: [], bodyMeasurements, warnings };
}
