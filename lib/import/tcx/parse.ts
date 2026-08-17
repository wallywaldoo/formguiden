import { sha256Hex } from "@/lib/import/checksum";
import {
  derivedPace,
  positiveInt,
  positiveNumber,
  toIso,
} from "@/lib/import/normalize";
import type {
  CanonicalActivity,
  CanonicalLap,
  ParseResult,
} from "@/lib/import/types";
import { elements, numberFrom, parseXml, text } from "@/lib/import/xml";

function mapTcxSport(value: string | null): CanonicalActivity["activityType"] {
  const sport = (value ?? "").toLowerCase();
  if (sport.includes("bik") || sport.includes("cycl")) {
    return "cycle";
  }
  if (sport.includes("walk")) {
    return "walk";
  }
  if (sport.includes("hik")) {
    return "hike";
  }
  return "run";
}

export function parseTcx(bytes: Uint8Array): ParseResult {
  const xml = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  let doc;
  try {
    doc = parseXml(xml);
  } catch {
    return {
      activities: [],
      dailyHealth: [],
      bodyMeasurements: [],
      warnings: [{ code: "tcx_xml", message: "TCX-filen kunde inte tolkas." }],
    };
  }

  const activities: CanonicalActivity[] = [];
  const warnings: ParseResult["warnings"] = [];

  for (const activityNode of elements(doc, "Activity")) {
    const sport = activityNode.getAttribute("Sport");
    const id = text(activityNode, "Id");
    const startedAt = toIso(id);
    const laps: CanonicalLap[] = [];
    let distanceM = 0;
    let durationS = 0;
    let calories = 0;
    let hrSum = 0;
    let hrCount = 0;
    let maxHr = 0;

    elements(activityNode, "Lap").forEach((lapNode, index) => {
      const lapDistance = numberFrom(lapNode, "DistanceMeters");
      const lapDuration = numberFrom(lapNode, "TotalTimeSeconds");
      const lapCalories = numberFrom(lapNode, "Calories");
      const avgHr = numberFrom(
        lapNode.getElementsByTagName("AverageHeartRateBpm")[0] ?? null,
        "Value",
      );
      const lapMaxHr = numberFrom(
        lapNode.getElementsByTagName("MaximumHeartRateBpm")[0] ?? null,
        "Value",
      );
      distanceM += lapDistance ?? 0;
      durationS += lapDuration ?? 0;
      calories += lapCalories ?? 0;
      if (avgHr != null) {
        hrSum += avgHr;
        hrCount += 1;
      }
      if (lapMaxHr != null) {
        maxHr = Math.max(maxHr, lapMaxHr);
      }
      laps.push({
        lapIndex: index + 1,
        kind: "lap",
        startedAt: toIso(lapNode.getAttribute("StartTime")),
        durationS: positiveInt(lapDuration),
        distanceM: positiveNumber(lapDistance),
        avgPaceSPerKm: derivedPace(lapDistance, positiveInt(lapDuration)),
        avgHeartRateBpm: avgHr,
        elevationGainM: null,
      });
    });

    if (!startedAt) {
      warnings.push({
        code: "tcx_missing_start",
        message: "En TCX-aktivitet saknar starttid och hoppades över.",
      });
      continue;
    }

    const avgHr = hrCount > 0 ? hrSum / hrCount : null;
    activities.push({
      externalId: `garmin-file:tcx:${id ?? sha256Hex(bytes)}`,
      activityType: mapTcxSport(sport),
      startedAt,
      endedAt: null,
      durationS: durationS > 0 ? Math.round(durationS) : null,
      durationKind: "elapsed",
      distanceM: distanceM > 0 ? distanceM : null,
      elevationGainM: null,
      elevationLossM: null,
      avgPaceSPerKm: derivedPace(
        distanceM > 0 ? distanceM : null,
        durationS > 0 ? durationS : null,
      ),
      avgHeartRateBpm: avgHr,
      maxHeartRateBpm: maxHr > 0 ? maxHr : null,
      avgCadence: null,
      caloriesKcal: calories > 0 ? calories : null,
      trainingLoad: null,
      notes: text(activityNode, "Notes"),
      laps,
    });
  }

  if (activities.length === 0) {
    warnings.push({
      code: "empty_tcx",
      message: "TCX-filen innehöll inga aktiviteter.",
    });
  }

  return { activities, dailyHealth: [], bodyMeasurements: [], warnings };
}
