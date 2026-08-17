import { describe, expect, it } from "vitest";

import {
  jsonIncludesUserIdEq,
  loadTableMetadata,
  permissionFor,
} from "./load-metadata";

const PUBLIC_TABLES = [
  "profiles",
  "user_preferences",
  "privacy_acknowledgements",
  "goals",
  "goal_snapshots",
  "integrations",
  "audit_events",
  "data_imports",
  "import_files",
  "import_jobs",
  "activities",
  "activity_laps",
  "daily_health_metrics",
  "body_measurements",
  "activity_previews",
  "activity_lap_previews",
  "daily_health_metric_previews",
  "body_measurement_previews",
  "ai_estimation_requests",
  "nutrition_entries",
  "hydration_entries",
  "strength_sessions",
  "strength_sets",
  "recommendations",
  "recommendation_signals",
  "data_export_jobs",
  "account_deletion_requests",
];

describe("Hasura metadata authorization contract", () => {
  const tables = loadTableMetadata();
  const byName = Object.fromEntries(
    tables.map((table) => [`${table.table.schema}.${table.table.name}`, table]),
  );

  it("tracks every public table plus storage.files", () => {
    for (const name of PUBLIC_TABLES) {
      expect(byName[`public.${name}`], name).toBeTruthy();
    }
    expect(byName["storage.files"]).toBeTruthy();
  });

  it("grants the public role no permissions on health or storage tables", () => {
    for (const table of tables) {
      for (const operation of [
        "insert",
        "select",
        "update",
        "delete",
      ] as const) {
        expect(
          permissionFor(table, operation, "public"),
          `${table.table.name} public ${operation}`,
        ).toBeUndefined();
      }
    }
  });

  it("scopes user select/update/delete to X-Hasura-User-Id and never lets clients set user_id", () => {
    for (const name of PUBLIC_TABLES) {
      const table = byName[`public.${name}`];
      const insert = permissionFor(table, "insert", "user");
      const select = permissionFor(table, "select", "user");

      expect(insert, `${name} insert`).toBeTruthy();
      expect(select, `${name} select`).toBeTruthy();
      expect(jsonIncludesUserIdEq(insert?.check)).toBe(true);
      expect(jsonIncludesUserIdEq(select?.filter)).toBe(true);
      expect(JSON.stringify(insert?.set ?? {})).toMatch(/x-hasura-user-id/i);
      expect(insert?.columns).not.toContain("user_id");

      const update = permissionFor(table, "update", "user");
      if (update) {
        expect(jsonIncludesUserIdEq(update.filter)).toBe(true);
        expect(jsonIncludesUserIdEq(update.check)).toBe(true);
        expect(update.columns).not.toContain("user_id");
      }
    }
  });

  it("requires garmin-imports ownership on storage.files", () => {
    const files = byName["storage.files"];
    for (const operation of ["insert", "select", "update", "delete"] as const) {
      const permission = permissionFor(files, operation, "user");
      expect(permission, `files ${operation}`).toBeTruthy();
      const blob = JSON.stringify(permission);
      expect(blob).toContain("garmin-imports");
      expect(blob).toContain("uploaded_by_user_id");
      expect(blob).toContain("X-Hasura-User-Id");
    }

    const insert = permissionFor(files, "insert", "user");
    expect(insert?.columns).not.toContain("uploaded_by_user_id");
    expect(JSON.stringify(insert?.set ?? {})).toMatch(/x-hasura-user-id/i);
  });
});
