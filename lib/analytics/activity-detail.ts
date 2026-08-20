import { mean, median, sampleStdDev } from "@/lib/analytics/stats";
import { formatPaceMinPerKm } from "@/lib/units/pace";

export type ActivitySampleInput = {
  elapsedS: number | null;
  distanceM: number | null;
  heartRateBpm: number | null;
  cadence: number | null;
  speedMps: number | null;
  altitudeM: number | null;
  powerW: number | null;
  temperatureC: number | null;
};

export type ActivityLapInput = {
  lapIndex: number;
  kind: string | null;
  durationS: number | null;
  distanceM: number | null;
  avgPaceSPerKm: number | null;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  avgCadence: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  caloriesKcal: number | null;
};

export type CompareRunInput = {
  id: string;
  startedAt: string;
  distanceM: number | null;
  durationS: number | null;
  paceSPerKm: number | null;
  avgHeartRateBpm: number | null;
};

export type ActivitySplit = {
  index: number;
  label: string;
  distanceM: number;
  durationS: number;
  paceSPerKm: number;
  avgHeartRateBpm: number | null;
  avgCadence: number | null;
  elevationDeltaM: number | null;
  avgPowerW: number | null;
  deltaVsAvgS: number | null;
};

export type BestEffort = {
  label: string;
  distanceM: number;
  durationS: number;
  paceSPerKm: number;
};

export type SeriesStats = {
  avg: number | null;
  min: number | null;
  max: number | null;
  median: number | null;
  stdDev: number | null;
  cvPct: number | null;
};

export type ActivityAnalysis = {
  kmSplits: ActivitySplit[];
  halves: {
    firstPaceSPerKm: number | null;
    secondPaceSPerKm: number | null;
    firstHr: number | null;
    secondHr: number | null;
    splitDeltaS: number | null;
    splitKind: "positive" | "negative" | "even" | null;
    decouplingPct: number | null;
  };
  pace: SeriesStats;
  heartRate: SeriesStats;
  cadence: SeriesStats;
  power: SeriesStats;
  temperature: SeriesStats;
  bestEfforts: BestEffort[];
  pauseS: number | null;
  gradeMPerKm: number | null;
  compare: {
    sampleSize: number;
    paceDeltaS: number | null;
    hrDeltaBpm: number | null;
    similarPaceSPerKm: number | null;
    similarHr: number | null;
  };
  hrZoneShare: Array<{ zone: number; secs: number; pct: number }>;
  insights: string[];
};

const PACE_MIN = 90;
const PACE_MAX = 900;
const COMPARE_DISTANCE_RATIO = 0.25;

function paceFromSpeed(speedMps: number | null): number | null {
  if (speedMps == null || speedMps <= 0) return null;
  const pace = 1000 / speedMps;
  return pace > PACE_MIN && pace < PACE_MAX ? pace : null;
}

function paceFromDistanceTime(
  distanceM: number | null,
  durationS: number | null,
): number | null {
  if (
    distanceM == null ||
    durationS == null ||
    distanceM < 50 ||
    durationS <= 0
  ) {
    return null;
  }
  const pace = durationS / (distanceM / 1000);
  return pace > PACE_MIN && pace < PACE_MAX ? pace : null;
}

function statsFrom(values: number[]): SeriesStats {
  if (values.length === 0) {
    return {
      avg: null,
      min: null,
      max: null,
      median: null,
      stdDev: null,
      cvPct: null,
    };
  }
  const avg = mean(values);
  const stdDev = sampleStdDev(values);
  return {
    avg,
    min: Math.min(...values),
    max: Math.max(...values),
    median: median(values),
    stdDev,
    cvPct: avg != null && avg !== 0 && stdDev != null ? (stdDev / avg) * 100 : null,
  };
}

function numberedSamples(samples: ActivitySampleInput[]) {
  return samples
    .map((sample, index) => ({
      ...sample,
      elapsedS:
        sample.elapsedS ??
        (index > 0 ? index : 0),
    }))
    .filter((sample) => sample.distanceM != null || sample.speedMps != null);
}

function kmSplitsFromLaps(laps: ActivityLapInput[]): ActivitySplit[] {
  const kmLike = laps.filter((lap) => {
    const distance = lap.distanceM ?? 0;
    return distance > 700 && distance < 1300;
  });
  const source = kmLike.length >= 2 ? kmLike : laps;
  const paces = source
    .map((lap) =>
      paceFromDistanceTime(lap.distanceM, lap.durationS) ?? lap.avgPaceSPerKm,
    )
    .filter((value): value is number => value != null);
  const avgPace = mean(paces);

  return source.flatMap((lap, index) => {
    const durationS = lap.durationS;
    const distanceM = lap.distanceM;
    if (durationS == null || durationS <= 0 || distanceM == null || distanceM <= 0) {
      return [];
    }
    const paceSPerKm =
      lap.avgPaceSPerKm ?? paceFromDistanceTime(distanceM, durationS);
    if (paceSPerKm == null) return [];
    return [
      {
        index: index + 1,
        label: `${index + 1}`,
        distanceM,
        durationS,
        paceSPerKm,
        avgHeartRateBpm: lap.avgHeartRateBpm,
        avgCadence: lap.avgCadence,
        elevationDeltaM:
          lap.elevationGainM != null || lap.elevationLossM != null
            ? (lap.elevationGainM ?? 0) - (lap.elevationLossM ?? 0)
            : null,
        avgPowerW: null,
        deltaVsAvgS: avgPace != null ? paceSPerKm - avgPace : null,
      },
    ];
  });
}

function kmSplitsFromSamples(samples: ActivitySampleInput[]): ActivitySplit[] {
  const points = numberedSamples(samples).filter(
    (sample) => sample.distanceM != null && sample.distanceM >= 0,
  );
  if (points.length < 8) return [];

  const splits: ActivitySplit[] = [];
  let cursor = 0;
  let km = 1;

  while (cursor < points.length - 1) {
    const start = points[cursor]!;
    const startDistance = start.distanceM ?? 0;
    const target = startDistance + 1000;
    let endIndex = points.findIndex(
      (point, index) => index > cursor && (point.distanceM ?? 0) >= target,
    );
    if (endIndex < 0) {
      const last = points[points.length - 1]!;
      const remaining = (last.distanceM ?? 0) - startDistance;
      if (remaining < 400) break;
      endIndex = points.length - 1;
    }
    const end = points[endIndex]!;
    const durationS = (end.elapsedS ?? 0) - (start.elapsedS ?? 0);
    const distanceM = (end.distanceM ?? 0) - startDistance;
    const paceSPerKm = paceFromDistanceTime(distanceM, durationS);
    if (paceSPerKm == null || durationS <= 0) {
      cursor = endIndex;
      km += 1;
      continue;
    }
    const window = points.slice(cursor, endIndex + 1);
    splits.push({
      index: km,
      label: distanceM < 950 ? `${(distanceM / 1000).toFixed(1)}` : `${km}`,
      distanceM,
      durationS,
      paceSPerKm,
      avgHeartRateBpm: mean(
        window
          .map((row) => row.heartRateBpm)
          .filter((value): value is number => value != null && value > 40),
      ),
      avgCadence: mean(
        window
          .map((row) => row.cadence)
          .filter((value): value is number => value != null && value > 50),
      ),
      elevationDeltaM: elevationDelta(window),
      avgPowerW: mean(
        window
          .map((row) => row.powerW)
          .filter((value): value is number => value != null && value > 0),
      ),
      deltaVsAvgS: null,
    });
    cursor = endIndex;
    km += 1;
  }

  const avgPace = mean(splits.map((split) => split.paceSPerKm));
  return splits.map((split) => ({
    ...split,
    deltaVsAvgS: avgPace != null ? split.paceSPerKm - avgPace : null,
  }));
}

function elevationDelta(window: ActivitySampleInput[]): number | null {
  const altitudes = window
    .map((row) => row.altitudeM)
    .filter((value): value is number => value != null);
  if (altitudes.length < 2) return null;
  return altitudes[altitudes.length - 1]! - altitudes[0]!;
}

function halfStats(samples: ActivitySampleInput[]) {
  const points = numberedSamples(samples).filter(
    (sample) => sample.distanceM != null,
  );
  if (points.length < 10) {
    return {
      firstPaceSPerKm: null,
      secondPaceSPerKm: null,
      firstHr: null,
      secondHr: null,
      splitDeltaS: null,
      splitKind: null as ActivityAnalysis["halves"]["splitKind"],
      decouplingPct: null,
    };
  }
  const startDistance = points[0]!.distanceM ?? 0;
  const endDistance = points[points.length - 1]!.distanceM ?? 0;
  const mid = startDistance + (endDistance - startDistance) / 2;
  const first = points.filter((point) => (point.distanceM ?? 0) <= mid);
  const second = points.filter((point) => (point.distanceM ?? 0) > mid);

  const firstPace = mean(
    first.map((row) => paceFromSpeed(row.speedMps)).filter((v): v is number => v != null),
  );
  const secondPace = mean(
    second.map((row) => paceFromSpeed(row.speedMps)).filter((v): v is number => v != null),
  );
  const firstHr = mean(
    first
      .map((row) => row.heartRateBpm)
      .filter((value): value is number => value != null && value > 40),
  );
  const secondHr = mean(
    second
      .map((row) => row.heartRateBpm)
      .filter((value): value is number => value != null && value > 40),
  );
  const splitDeltaS =
    firstPace != null && secondPace != null ? secondPace - firstPace : null;
  let splitKind: ActivityAnalysis["halves"]["splitKind"] = null;
  if (splitDeltaS != null) {
    if (splitDeltaS > 5) splitKind = "positive";
    else if (splitDeltaS < -5) splitKind = "negative";
    else splitKind = "even";
  }
  let decouplingPct: number | null = null;
  if (
    firstPace != null &&
    secondPace != null &&
    firstHr != null &&
    secondHr != null &&
    firstPace > 0 &&
    secondPace > 0
  ) {
    const firstLoad = firstHr / (1000 / firstPace);
    const secondLoad = secondHr / (1000 / secondPace);
    if (firstLoad > 0) {
      decouplingPct = ((secondLoad - firstLoad) / firstLoad) * 100;
    }
  }
  return {
    firstPaceSPerKm: firstPace,
    secondPaceSPerKm: secondPace,
    firstHr,
    secondHr,
    splitDeltaS,
    splitKind,
    decouplingPct,
  };
}

function bestEffort(
  samples: ActivitySampleInput[],
  distanceM: number,
  label: string,
): BestEffort | null {
  const points = numberedSamples(samples).filter(
    (sample) => sample.distanceM != null && sample.elapsedS != null,
  );
  if (points.length < 8) return null;
  const total =
    (points[points.length - 1]!.distanceM ?? 0) - (points[0]!.distanceM ?? 0);
  if (total < distanceM * 0.98) return null;

  let best: { durationS: number } | null = null;
  let end = 0;
  for (let start = 0; start < points.length; start += 1) {
    const startDistance = points[start]!.distanceM ?? 0;
    const startElapsed = points[start]!.elapsedS ?? 0;
    while (
      end < points.length &&
      (points[end]!.distanceM ?? 0) - startDistance < distanceM
    ) {
      end += 1;
    }
    if (end >= points.length) break;
    const durationS = (points[end]!.elapsedS ?? 0) - startElapsed;
    if (durationS <= 0) continue;
    if (best == null || durationS < best.durationS) {
      best = { durationS };
    }
  }
  if (best == null) return null;
  const paceSPerKm = paceFromDistanceTime(distanceM, best.durationS);
  if (paceSPerKm == null) return null;
  return { label, distanceM, durationS: best.durationS, paceSPerKm };
}

function hrZonesFromSamples(
  samples: ActivitySampleInput[],
  maxHeartRateBpm: number | null,
): Array<{ zone: number; secs: number; pct: number }> {
  const maxHr =
    maxHeartRateBpm ??
    Math.max(
      0,
      ...samples
        .map((sample) => sample.heartRateBpm ?? 0)
        .filter((value) => value > 80),
    );
  if (maxHr < 120) return [];
  const bounds = [0.6, 0.7, 0.8, 0.9, 1.2].map((ratio) => ratio * maxHr);
  const secs = [0, 0, 0, 0, 0];
  const points = numberedSamples(samples);
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]!;
    const current = points[index]!;
    const dt = (current.elapsedS ?? 0) - (prev.elapsedS ?? 0);
    const hr = current.heartRateBpm;
    if (dt <= 0 || dt > 30 || hr == null || hr < 40) continue;
    const zoneIndex = bounds.findIndex((bound) => hr < bound);
    secs[zoneIndex < 0 ? 4 : zoneIndex] += dt;
  }
  const total = secs.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  return secs.map((value, index) => ({
    zone: index + 1,
    secs: value,
    pct: (value / total) * 100,
  }));
}

function compareRuns(
  current: { distanceM: number | null; paceSPerKm: number | null; avgHr: number | null },
  recent: CompareRunInput[],
) {
  const similar = recent.filter((run) => {
    if (current.distanceM == null || run.distanceM == null) return false;
    const ratio =
      Math.abs(run.distanceM - current.distanceM) / current.distanceM;
    return ratio <= COMPARE_DISTANCE_RATIO;
  });
  const paces = similar
    .map((run) => run.paceSPerKm)
    .filter((value): value is number => value != null);
  const hrs = similar
    .map((run) => run.avgHeartRateBpm)
    .filter((value): value is number => value != null);
  const similarPace = mean(paces);
  const similarHr = mean(hrs);
  return {
    sampleSize: similar.length,
    similarPaceSPerKm: similarPace,
    similarHr,
    paceDeltaS:
      current.paceSPerKm != null && similarPace != null
        ? current.paceSPerKm - similarPace
        : null,
    hrDeltaBpm:
      current.avgHr != null && similarHr != null ? current.avgHr - similarHr : null,
  };
}

function buildInsights(input: {
  halves: ActivityAnalysis["halves"];
  compare: ActivityAnalysis["compare"];
  pace: SeriesStats;
  cadence: SeriesStats;
  hrZoneShare: ActivityAnalysis["hrZoneShare"];
  pauseS: number | null;
  durationS: number | null;
  elevationGainM: number | null;
  distanceM: number | null;
}): string[] {
  const insights: string[] = [];
  if (input.halves.splitKind === "negative") {
    insights.push(
      `Negativ split: andra halvan var ${Math.abs(Math.round(input.halves.splitDeltaS ?? 0))} s/km snabbare än första.`,
    );
  } else if (input.halves.splitKind === "positive") {
    insights.push(
      `Positiv split: andra halvan gick ${Math.round(input.halves.splitDeltaS ?? 0)} s/km långsammare. Håll igen lite tidigare nästa gång om du vill jämna ut.`,
    );
  } else if (input.halves.splitKind === "even") {
    insights.push("Jämn split: tempot höll i sig från start till mål.");
  }

  if (input.halves.decouplingPct != null) {
    if (input.halves.decouplingPct > 6) {
      insights.push(
        `Aerob decoupling ${input.halves.decouplingPct.toFixed(1)} %: pulsen steg mer än tempot på slutet, ett tecken på att durabiliteten började ta slut.`,
      );
    } else if (input.halves.decouplingPct < 3) {
      insights.push(
        `Låg decoupling (${input.halves.decouplingPct.toFixed(1)} %): pulsen följde tempot. Aerob kontroll var bra.`,
      );
    }
  }

  if (input.compare.paceDeltaS != null && input.compare.sampleSize >= 3) {
    if (input.compare.paceDeltaS < -5) {
      insights.push(
        `Snabbare än dina ${input.compare.sampleSize} senaste liknande pass: ${formatPaceMinPerKm(Math.abs(input.compare.paceDeltaS))} /km under snittet.`,
      );
    } else if (input.compare.paceDeltaS > 8) {
      insights.push(
        `Långsammare än dina senaste liknande pass (${formatPaceMinPerKm(input.compare.paceDeltaS)} /km över snittet). Kan vara underlag, höjd eller medvetet lätt.`,
      );
    } else {
      insights.push("Tempot ligger i linje med dina senaste liknande pass.");
    }
  }

  const topZone = [...input.hrZoneShare].sort((a, b) => b.secs - a.secs)[0];
  if (topZone && topZone.pct >= 35) {
    const labels = ["Z1 återhämtning", "Z2 grund", "Z3 tempo", "Z4 tröskel", "Z5 max"];
    insights.push(
      `Mest tid i ${labels[topZone.zone - 1] ?? `Z${topZone.zone}`} (${Math.round(topZone.pct)} %).`,
    );
  }

  if (input.cadence.avg != null) {
    if (input.cadence.avg < 160) {
      insights.push(
        `Kadens ${Math.round(input.cadence.avg)} spm, i underkant för många löpare. Korta steget lite om det känns naturligt.`,
      );
    } else if (input.cadence.avg >= 170) {
      insights.push(`Kadens ${Math.round(input.cadence.avg)} spm: kort, ekonomiskt steg.`);
    }
  }

  if (
    input.pace.cvPct != null &&
    input.pace.cvPct > 8 &&
    (input.elevationGainM == null || input.elevationGainM < 40)
  ) {
    insights.push(
      `Tempot svängde en del (CV ${input.pace.cvPct.toFixed(0)} %). Surges kostar mer än ett jämnt Z2-pass.`,
    );
  }

  if (
    input.pauseS != null &&
    input.durationS != null &&
    input.pauseS > 45 &&
    input.pauseS / input.durationS > 0.04
  ) {
    insights.push(
      `Cirka ${Math.round(input.pauseS)} s stillastående. Räkna förflyttningstid om du jämför med rena tävlingspass.`,
    );
  }

  if (input.elevationGainM != null && input.distanceM != null && input.distanceM > 0) {
    const perKm = input.elevationGainM / (input.distanceM / 1000);
    if (perKm > 20) {
      insights.push(
        `Kuperat pass: ${Math.round(input.elevationGainM)} m stigning, ca ${Math.round(perKm)} m/km.`,
      );
    }
  }

  return insights.slice(0, 8);
}

export function analyzeActivity(input: {
  samples: ActivitySampleInput[];
  laps: ActivityLapInput[];
  durationS: number | null;
  movingDurationS: number | null;
  elapsedDurationS: number | null;
  distanceM: number | null;
  paceSPerKm: number | null;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  recentRuns: CompareRunInput[];
}): ActivityAnalysis {
  const samplePaces = input.samples
    .map((sample) => paceFromSpeed(sample.speedMps))
    .filter((value): value is number => value != null);
  const sampleHrs = input.samples
    .map((sample) => sample.heartRateBpm)
    .filter((value): value is number => value != null && value > 40);
  const sampleCadence = input.samples
    .map((sample) => sample.cadence)
    .filter((value): value is number => value != null && value > 50);
  const samplePower = input.samples
    .map((sample) => sample.powerW)
    .filter((value): value is number => value != null && value > 0);
  const sampleTemp = input.samples
    .map((sample) => sample.temperatureC)
    .filter((value): value is number => value != null);

  const fromLaps = kmSplitsFromLaps(input.laps);
  const kmSplits =
    fromLaps.length >= 2 ? fromLaps : kmSplitsFromSamples(input.samples);
  const halves = halfStats(input.samples);
  const pauseS =
    input.elapsedDurationS != null && input.movingDurationS != null
      ? Math.max(0, input.elapsedDurationS - input.movingDurationS)
      : input.elapsedDurationS != null && input.durationS != null
        ? Math.max(0, input.elapsedDurationS - input.durationS)
        : null;
  const compare = compareRuns(
    {
      distanceM: input.distanceM,
      paceSPerKm: input.paceSPerKm,
      avgHr: input.avgHeartRateBpm,
    },
    input.recentRuns,
  );
  const hrZoneShare = hrZonesFromSamples(input.samples, input.maxHeartRateBpm);
  const gradeMPerKm =
    input.elevationGainM != null && input.distanceM != null && input.distanceM > 0
      ? input.elevationGainM / (input.distanceM / 1000)
      : null;

  const bestEfforts = (
    [
      bestEffort(input.samples, 400, "400 m"),
      bestEffort(input.samples, 1000, "1 km"),
      bestEffort(input.samples, 5000, "5 km"),
      bestEffort(input.samples, 10000, "10 km"),
    ] as Array<BestEffort | null>
  ).filter((row): row is BestEffort => row != null);

  const pace = statsFrom(samplePaces);
  const heartRate = statsFrom(sampleHrs);
  const cadence = statsFrom(sampleCadence);
  const analysis: ActivityAnalysis = {
    kmSplits,
    halves,
    pace: {
      ...pace,
      avg: pace.avg ?? input.paceSPerKm,
    },
    heartRate: {
      ...heartRate,
      avg: heartRate.avg ?? input.avgHeartRateBpm,
      max: heartRate.max ?? input.maxHeartRateBpm,
    },
    cadence: statsFrom(sampleCadence),
    power: statsFrom(samplePower),
    temperature: statsFrom(sampleTemp),
    bestEfforts,
    pauseS,
    gradeMPerKm,
    compare,
    hrZoneShare,
    insights: [],
  };
  analysis.insights = buildInsights({
    halves,
    compare,
    pace: analysis.pace,
    cadence,
    hrZoneShare,
    pauseS,
    durationS: input.durationS,
    elevationGainM: input.elevationGainM,
    distanceM: input.distanceM,
  });
  return analysis;
}
