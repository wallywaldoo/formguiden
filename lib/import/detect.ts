export const FILE_KINDS = [
  "fit",
  "tcx",
  "gpx",
  "csv",
  "zip",
  "sqlite",
  "json",
  "unknown",
] as const;

export type FileKind = (typeof FILE_KINDS)[number];

const FIT_MARKER = new TextEncoder().encode(".FIT");
const ZIP_LOCAL = [0x50, 0x4b, 0x03, 0x04];
const ZIP_EMPTY = [0x50, 0x4b, 0x05, 0x06];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const SQLITE = [...new TextEncoder().encode("SQLite format 3"), 0x00];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((value, index) => bytes[index] === value);
}

function asTextSample(bytes: Uint8Array): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, 4096));
  return new TextDecoder("utf-8", { fatal: false })
    .decode(slice)
    .replace(/^\uFEFF/, "");
}

export function detectFileKind(bytes: Uint8Array): FileKind {
  if (bytes.length < 4) {
    return "unknown";
  }
  if (startsWith(bytes, ZIP_LOCAL) || startsWith(bytes, ZIP_EMPTY)) {
    return "zip";
  }
  if (startsWith(bytes, SQLITE)) {
    return "sqlite";
  }
  if (startsWith(bytes, PNG)) {
    return "unknown";
  }
  if (
    bytes.length >= 12 &&
    bytes[8] === FIT_MARKER[0] &&
    bytes[9] === FIT_MARKER[1] &&
    bytes[10] === FIT_MARKER[2] &&
    bytes[11] === FIT_MARKER[3]
  ) {
    return "fit";
  }

  const sample = asTextSample(bytes).trim();
  if (sample.startsWith("<")) {
    const lower = sample.slice(0, 800).toLowerCase();
    if (lower.includes("trainingcenterdatabase")) {
      return "tcx";
    }
    if (lower.includes("<gpx") || lower.includes("://www.topografix.com/gpx")) {
      return "gpx";
    }
  }

  // Only a top-level object counts. Garmin's own exports are arrays or CSV, so
  // this stays narrow enough not to swallow them.
  if (sample.startsWith("{")) {
    return "json";
  }

  if (looksLikeCsv(sample)) {
    return "csv";
  }

  return "unknown";
}

function looksLikeCsv(sample: string): boolean {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  if (!firstLine || firstLine.startsWith("<")) {
    return false;
  }
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return commaCount >= 2 || semicolonCount >= 2;
}
