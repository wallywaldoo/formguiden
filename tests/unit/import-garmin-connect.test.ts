import { describe, expect, it } from "vitest";

import {
  extractGarminConnectProvenance,
  provenanceAllowsAutoCommit,
} from "@/lib/import/garmin-connect/autocommit";

const base = {
  engine: "python-garminconnect" as const,
  engineVersion: "0.3.2",
  scriptVersion: "1",
};

describe("garmin-connect auto-commit", () => {
  it("refuses the first run", () => {
    expect(provenanceAllowsAutoCommit(base, null)).toBe(false);
    expect(provenanceAllowsAutoCommit(null, base)).toBe(false);
  });

  it("allows a matching subsequent run", () => {
    expect(provenanceAllowsAutoCommit(base, { ...base })).toBe(true);
  });

  it("refuses a script or library bump", () => {
    expect(
      provenanceAllowsAutoCommit(base, { ...base, scriptVersion: "2" }),
    ).toBe(false);
    expect(
      provenanceAllowsAutoCommit(base, { ...base, engineVersion: "0.4.0" }),
    ).toBe(false);
  });

  it("reads provenance nested under garminConnect", () => {
    expect(extractGarminConnectProvenance({ garminConnect: base })).toEqual(
      base,
    );
    expect(
      extractGarminConnectProvenance({ garmindb: { dbVersion: 14 } }),
    ).toBe(null);
  });
});
