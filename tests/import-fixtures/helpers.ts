import { Encoder, Profile, type Mesg } from "@garmin/fitsdk";
import { zipSync } from "fflate";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = dirname(fileURLToPath(import.meta.url));

export function readFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixturesDir, name)));
}

export function pngBytes(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
}

export function truncatedFitBytes(): Uint8Array {
  const bytes = new Uint8Array(14);
  bytes[0] = 14;
  bytes.set(new TextEncoder().encode(".FIT"), 8);
  return bytes;
}

export function encodeActivityFit(): Uint8Array {
  const encoder = new Encoder();
  const start = new Date("2026-04-12T07:00:00.000Z");
  const end = new Date("2026-04-12T08:30:00.000Z");
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    manufacturer: "development",
    product: 1,
    timeCreated: start,
    type: "activity",
  } as Mesg);
  encoder.onMesg(Profile.MesgNum.SESSION, {
    timestamp: end,
    startTime: start,
    totalElapsedTime: 5400,
    totalTimerTime: 5400,
    totalDistance: 21097.5,
    sport: "running",
    avgHeartRate: 152,
    maxHeartRate: 171,
  } as Mesg);
  encoder.onMesg(Profile.MesgNum.LAP, {
    timestamp: end,
    startTime: start,
    totalElapsedTime: 5400,
    totalTimerTime: 5400,
    totalDistance: 21097.5,
    avgHeartRate: 152,
  } as Mesg);
  return encoder.close();
}

export function zipFromEntries(
  entries: Record<string, Uint8Array>,
): Uint8Array {
  return zipSync(entries);
}
