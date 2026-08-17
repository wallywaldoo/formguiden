import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const tablesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../nhost/metadata/databases/default/tables",
);

export type HasuraTableMetadata = {
  table: { name: string; schema: string };
  insert_permissions?: Array<{
    role: string;
    permission: Record<string, unknown>;
  }>;
  select_permissions?: Array<{
    role: string;
    permission: Record<string, unknown>;
  }>;
  update_permissions?: Array<{
    role: string;
    permission: Record<string, unknown>;
  }>;
  delete_permissions?: Array<{
    role: string;
    permission: Record<string, unknown>;
  }>;
};

export function loadTableMetadata(): HasuraTableMetadata[] {
  return readdirSync(tablesDir)
    .filter((file) => file.endsWith(".yaml") && file !== "tables.yaml")
    .map(
      (file) =>
        parse(
          readFileSync(join(tablesDir, file), "utf8"),
        ) as HasuraTableMetadata,
    );
}

export function permissionFor(
  table: HasuraTableMetadata,
  operation: "insert" | "select" | "update" | "delete",
  role: string,
) {
  const list = table[`${operation}_permissions`];
  return list?.find((entry) => entry.role === role)?.permission;
}

export function jsonIncludesUserIdEq(value: unknown): boolean {
  return JSON.stringify(value).includes("X-Hasura-User-Id");
}
