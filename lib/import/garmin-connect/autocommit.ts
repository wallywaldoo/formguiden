import type { GarminConnectProvenance } from "@/lib/import/garmin-connect/schema";

/**
 * Auto-commit is allowed only when this run was produced by the same runner
 * the user already approved. A first sync, a library bump, or a script bump
 * stays on preview so a silent mapping change cannot land unreviewed rows.
 */
export function provenanceAllowsAutoCommit(
  current: GarminConnectProvenance | null | undefined,
  lastApproved: GarminConnectProvenance | null | undefined,
): boolean {
  if (!current || !lastApproved) {
    return false;
  }
  return (
    current.engine === lastApproved.engine &&
    current.engineVersion === lastApproved.engineVersion &&
    current.scriptVersion === lastApproved.scriptVersion
  );
}

export function extractGarminConnectProvenance(
  value: unknown,
): GarminConnectProvenance | null {
  const candidate = unwrap(value);
  if (!candidate) {
    return null;
  }
  if (
    candidate.engine === "python-garminconnect" &&
    typeof candidate.engineVersion === "string" &&
    candidate.engineVersion.length > 0 &&
    typeof candidate.scriptVersion === "string" &&
    candidate.scriptVersion.length > 0
  ) {
    return {
      engine: "python-garminconnect",
      engineVersion: candidate.engineVersion,
      scriptVersion: candidate.scriptVersion,
    };
  }
  return null;
}

function unwrap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.garminConnect && typeof record.garminConnect === "object") {
    return record.garminConnect as Record<string, unknown>;
  }
  return record;
}
