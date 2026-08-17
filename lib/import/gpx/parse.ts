import { sha256Hex } from "@/lib/import/checksum";
import { derivedPace, toIso } from "@/lib/import/normalize";
import type { CanonicalActivity, ParseResult } from "@/lib/import/types";
import { elements, parseXml } from "@/lib/import/xml";

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function parseGpx(bytes: Uint8Array): ParseResult {
  const xml = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const warnings: ParseResult["warnings"] = [];
  let doc;
  try {
    doc = parseXml(xml);
  } catch {
    return {
      activities: [],
      dailyHealth: [],
      bodyMeasurements: [],
      warnings: [{ code: "gpx_xml", message: "GPX-filen kunde inte tolkas." }],
    };
  }

  const points = elements(doc, "trkpt");
  if (points.length === 0) {
    return {
      activities: [],
      dailyHealth: [],
      bodyMeasurements: [],
      warnings: [
        { code: "empty_gpx", message: "GPX-filen saknar spårpunkter." },
      ],
    };
  }

  let distanceM = 0;
  let elevationGainM = 0;
  let prev: {
    lat: number;
    lon: number;
    ele: number | null;
    time: string | null;
  } | null = null;
  let startedAt: string | null = null;
  let endedAt: string | null = null;

  for (const point of points) {
    const lat = Number.parseFloat(point.getAttribute("lat") ?? "");
    const lon = Number.parseFloat(point.getAttribute("lon") ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    const eleText = point.getElementsByTagName("ele")[0]?.textContent;
    const ele = eleText ? Number.parseFloat(eleText) : null;
    const time = toIso(point.getElementsByTagName("time")[0]?.textContent);
    startedAt ??= time;
    if (time) {
      endedAt = time;
    }
    if (prev) {
      distanceM += haversineMeters(prev.lat, prev.lon, lat, lon);
      if (prev.ele != null && ele != null && ele > prev.ele) {
        elevationGainM += ele - prev.ele;
      }
    }
    prev = { lat, lon, ele: Number.isFinite(ele) ? ele : null, time };
  }

  if (!startedAt) {
    warnings.push({
      code: "gpx_timezone",
      message: "GPX saknar tidsstämplar. Starttid kunde inte bestämmas.",
    });
    return { activities: [], dailyHealth: [], bodyMeasurements: [], warnings };
  }

  const durationS =
    endedAt && startedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(endedAt).getTime() - new Date(startedAt).getTime()) /
              1000,
          ),
        )
      : null;

  const activity: CanonicalActivity = {
    externalId: `garmin-file:gpx:${sha256Hex(bytes)}:${startedAt}`,
    activityType: "run",
    startedAt,
    endedAt,
    durationS,
    durationKind: "elapsed",
    distanceM: distanceM > 0 ? distanceM : null,
    elevationGainM: elevationGainM > 0 ? elevationGainM : null,
    elevationLossM: null,
    avgPaceSPerKm: derivedPace(distanceM > 0 ? distanceM : null, durationS),
    avgHeartRateBpm: null,
    maxHeartRateBpm: null,
    avgCadence: null,
    caloriesKcal: null,
    trainingLoad: null,
    notes: null,
    laps: [],
  };

  warnings.push({
    code: "gpx_no_hr",
    message: "GPX innehåller sällan puls. Distans är beräknad från GPS.",
  });

  return {
    activities: [activity],
    dailyHealth: [],
    bodyMeasurements: [],
    warnings,
  };
}
