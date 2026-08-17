import { describe, expect, it } from "vitest";

import { sha256Hex } from "@/lib/import/checksum";
import { detectFileKind } from "@/lib/import/detect";
import { inspectAndParse } from "@/lib/import/parse-bytes";

import {
  encodeActivityFit,
  pngBytes,
  readFixture,
  truncatedFitBytes,
} from "../import-fixtures/helpers";

describe("import detection and checksums", () => {
  it("hashes bytes with SHA-256", () => {
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("detects ZIP, FIT, TCX, GPX and CSV from content", () => {
    expect(detectFileKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(
      "zip",
    );
    expect(detectFileKind(encodeActivityFit())).toBe("fit");
    expect(detectFileKind(readFixture("activity.tcx"))).toBe("tcx");
    expect(detectFileKind(readFixture("activity.gpx"))).toBe("gpx");
    expect(detectFileKind(readFixture("activities.csv"))).toBe("csv");
  });

  it("does not trust a PNG that is named like a FIT file", () => {
    expect(detectFileKind(pngBytes())).toBe("unknown");
    const parsed = inspectAndParse(pngBytes());
    expect(parsed.kind).toBe("unknown");
    expect(parsed.parse.activities).toEqual([]);
  });

  it("rejects a truncated FIT header", () => {
    const kind = detectFileKind(truncatedFitBytes());
    expect(kind).toBe("fit");
    const parsed = inspectAndParse(truncatedFitBytes());
    expect(parsed.parse.activities).toEqual([]);
    expect(parsed.parse.warnings.length).toBeGreaterThan(0);
  });
});
