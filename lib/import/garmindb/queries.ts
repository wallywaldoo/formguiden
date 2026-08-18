import {
  ATTRIBUTES_TABLE,
  DB_ATTRIBUTES_TABLE,
  MAX_ROWS_PER_TABLE,
  SUPPORTED_TABLES,
  type SupportedTable,
} from "@/lib/import/garmindb/schema";

/**
 * Every statement is assembled at module load from the frozen constants in
 * schema.ts. Nothing from an uploaded file, a filename, or a request ever
 * reaches SQL. The identifier guard below is a second line of defence against
 * a future edit introducing an unsafe name.
 */
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function identifier(name: string): string {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`Unsafe SQL identifier in schema allowlist: ${name}`);
  }
  return name;
}

export const SCHEMA_OBJECTS_SQL = "SELECT type, name, sql FROM sqlite_master";

export const DB_VERSION_SQL = `SELECT value FROM ${identifier(
  DB_ATTRIBUTES_TABLE,
)} WHERE key = 'db.version' LIMIT 1`;

export const TABLE_VERSIONS_SQL = `SELECT key, value FROM ${identifier(
  DB_ATTRIBUTES_TABLE,
)} WHERE key LIKE '%.version' LIMIT 500`;

export const MEASUREMENT_SYSTEM_SQL = `SELECT value FROM ${identifier(
  ATTRIBUTES_TABLE,
)} WHERE key = 'measurement_system' LIMIT 1`;

/**
 * Builds the read for one supported table using only the columns present in
 * the file, so an older or newer GarminDB release does not fail the whole
 * import over a single added or removed optional column.
 */
export function buildTableSelect(
  table: SupportedTable,
  presentColumns: readonly string[],
): string {
  const spec = SUPPORTED_TABLES[table];
  const allowed = new Set<string>([...spec.required, ...spec.optional]);
  const columns = presentColumns
    .filter((column) => allowed.has(column))
    .map(identifier);

  if (columns.length === 0) {
    throw new Error(`No allowlisted columns resolved for table ${table}`);
  }

  return `SELECT ${columns.join(", ")} FROM ${identifier(
    table,
  )} ORDER BY ${identifier(spec.required[0])} LIMIT ${MAX_ROWS_PER_TABLE}`;
}
