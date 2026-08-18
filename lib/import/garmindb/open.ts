import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

import { reject } from "@/lib/import/garmindb/errors";
import { MAX_UPLOAD_BYTES } from "@/lib/import/limits";
import {
  DB_VERSION_SQL,
  MEASUREMENT_SYSTEM_SQL,
  SCHEMA_OBJECTS_SQL,
  TABLE_VERSIONS_SQL,
  buildTableSelect,
} from "@/lib/import/garmindb/queries";
import {
  GARMINDB_SLICE_BUDGET_MS,
  KNOWN_UNSUPPORTED_DATABASES,
  MAX_ROWS_PER_IMPORT,
  MAX_ROWS_PER_TABLE,
  SUPPORTED_DB_VERSION,
  SUPPORTED_TABLES,
  SUPPORTED_TABLE_NAMES,
  type SupportedTable,
} from "@/lib/import/garmindb/schema";

export const SQLITE_MAGIC = "SQLite format 3\u0000";

export function isSqliteFile(bytes: Uint8Array): boolean {
  if (bytes.byteLength < SQLITE_MAGIC.length) {
    return false;
  }
  for (let index = 0; index < SQLITE_MAGIC.length; index += 1) {
    if (bytes[index] !== SQLITE_MAGIC.charCodeAt(index)) {
      return false;
    }
  }
  return true;
}

/**
 * The WASM binary is loaded from our own dependency tree, never a CDN. It is
 * initialised once per process; the module itself holds no database state.
 */
let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = (async () => {
      const require = createRequire(import.meta.url);
      // Derived from the package entry rather than written as a specifier, so
      // the bundler does not try to compile the WASM as a module graph node.
      const wasmPath = join(
        dirname(require.resolve("sql.js")),
        "sql-wasm.wasm",
      );
      const file = await readFile(wasmPath);
      // Node pools Buffer memory, so slice out an exactly sized ArrayBuffer.
      const wasmBinary = file.buffer.slice(
        file.byteOffset,
        file.byteOffset + file.byteLength,
      ) as ArrayBuffer;
      return initSqlJs({ wasmBinary });
    })().catch((error: unknown) => {
      sqlJsPromise = null;
      throw error;
    });
  }
  return sqlJsPromise;
}

export type SchemaObject = {
  type: string;
  name: string;
  sql: string | null;
};

export type TableRow = Record<string, string | number | null>;

export type GarminDbProvenance = {
  database: string;
  schemaVersion: number;
  tableVersions: Record<string, number>;
  presentTables: SupportedTable[];
  missingOptionalColumns: Record<string, string[]>;
  rowCounts: Record<string, number>;
};

export type GarminDbReader = {
  provenance: GarminDbProvenance;
  /** Raw `attributes.measurement_system`, or null when the key is absent. */
  measurementSystemRaw: string | null;
  readTable(table: SupportedTable): TableRow[];
  close(): void;
};

function execRows(
  db: Database,
  sql: string,
): { columns: string[]; values: (string | number | Uint8Array | null)[][] } {
  let result;
  try {
    result = db.exec(sql);
  } catch {
    reject(
      "sqlite_unreadable",
      "Databasfilen kunde inte läsas. Den kan vara skadad eller ofullständig.",
    );
  }
  if (result.length === 0) {
    return { columns: [], values: [] };
  }
  return { columns: result[0].columns, values: result[0].values };
}

function scalar(db: Database, sql: string): string | null {
  const { values } = execRows(db, sql);
  const cell = values[0]?.[0];
  return cell === undefined || cell === null ? null : String(cell);
}

const VIRTUAL_TABLE_PATTERN = /create\s+virtual\s+table/i;

function inspectSchema(db: Database): SchemaObject[] {
  const { columns, values } = execRows(db, SCHEMA_OBJECTS_SQL);
  const typeIndex = columns.indexOf("type");
  const nameIndex = columns.indexOf("name");
  const sqlIndex = columns.indexOf("sql");
  return values.map((row) => ({
    type: String(row[typeIndex] ?? ""),
    name: String(row[nameIndex] ?? ""),
    sql: row[sqlIndex] === null ? null : String(row[sqlIndex]),
  }));
}

function assertSafeSchema(objects: SchemaObject[]): void {
  for (const object of objects) {
    if (object.type === "trigger") {
      reject(
        "schema_object_rejected",
        "Databasfilen innehåller triggers och kan inte importeras.",
      );
    }
    if (object.sql && VIRTUAL_TABLE_PATTERN.test(object.sql)) {
      reject(
        "schema_object_rejected",
        "Databasfilen innehåller virtuella tabeller och kan inte importeras.",
      );
    }
  }
}

function assertNotAnotherGarminDb(objects: SchemaObject[]): void {
  const names = new Set(objects.map((object) => object.name));
  // These tables identify the other GarminDB databases, none of which we read.
  const signatures: Record<
    string,
    (typeof KNOWN_UNSUPPORTED_DATABASES)[number]
  > = {
    activities: "garmin_activities",
    monitoring_info: "garmin_monitoring",
    days_summary: "summary",
  };
  for (const [table, database] of Object.entries(signatures)) {
    if (names.has(table)) {
      reject(
        "unsupported_database",
        `Filen ser ut att vara ${database}.db. Ladda upp garmin.db i stället — aktiviteter importerar du som FIT-filer.`,
      );
    }
  }
}

function realTableNames(objects: SchemaObject[]): Set<string> {
  return new Set(
    objects
      .filter((object) => object.type === "table")
      .map((object) => object.name),
  );
}

function columnsOf(db: Database, table: string): string[] {
  // Table name comes from the frozen allowlist in schema.ts, never from input.
  const { columns, values } = execRows(db, `PRAGMA table_info(${table})`);
  const nameIndex = columns.indexOf("name");
  if (nameIndex === -1) {
    return [];
  }
  return values.map((row) => String(row[nameIndex] ?? ""));
}

function readTableVersions(db: Database): Record<string, number> {
  const { columns, values } = execRows(db, TABLE_VERSIONS_SQL);
  const keyIndex = columns.indexOf("key");
  const valueIndex = columns.indexOf("value");
  const versions: Record<string, number> = {};
  if (keyIndex === -1 || valueIndex === -1) {
    return versions;
  }
  for (const row of values) {
    const key = String(row[keyIndex] ?? "");
    const table = key.replace(/\.version$/, "");
    if (!SUPPORTED_TABLE_NAMES.includes(table as SupportedTable)) {
      continue;
    }
    const parsed = Number.parseInt(String(row[valueIndex] ?? ""), 10);
    if (Number.isFinite(parsed)) {
      versions[table] = parsed;
    }
  }
  return versions;
}

/**
 * Opens an uploaded GarminDB database inside the sql.js WASM sandbox.
 *
 * The engine is built without loadable extensions, so `load_extension`,
 * `fileio`, and `csv` do not exist. We never write, never `ATTACH`, and never
 * execute SQL derived from file content. The caller must call `close()`.
 */
export async function openGarminDb(
  bytes: Uint8Array,
  options: { now?: () => number } = {},
): Promise<GarminDbReader> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    reject(
      "file_too_large",
      "Databasfilen är större än 25 MiB. Kör GarminDB:s backup och ladda upp garmin.db separat.",
    );
  }
  if (!isSqliteFile(bytes)) {
    reject("not_sqlite", "Filen är inte en SQLite-databas.");
  }

  const now = options.now ?? (() => Date.now());
  const deadline = now() + GARMINDB_SLICE_BUDGET_MS;

  const SQL = await loadSqlJs();
  let db: Database;
  try {
    db = new SQL.Database(bytes);
  } catch {
    reject(
      "sqlite_unreadable",
      "Databasfilen kunde inte läsas. Den kan vara skadad eller ofullständig.",
    );
  }

  try {
    const objects = inspectSchema(db);
    assertSafeSchema(objects);
    assertNotAnotherGarminDb(objects);

    const tables = realTableNames(objects);
    if (!tables.has("_attributes")) {
      reject(
        "not_garmindb",
        "Filen är en SQLite-databas men inte en GarminDB-databas.",
      );
    }

    const rawVersion = scalar(db, DB_VERSION_SQL);
    const version = Number.parseInt(rawVersion ?? "", 10);
    if (!Number.isFinite(version)) {
      reject(
        "not_garmindb",
        "Filen saknar GarminDB:s versionsinformation och kan inte importeras.",
      );
    }
    if (version !== SUPPORTED_DB_VERSION) {
      reject(
        "unsupported_schema_version",
        `Formkurvan stöder GarminDB-schema version ${SUPPORTED_DB_VERSION}, filen har version ${version}. Uppdatera GarminDB och kör om --rebuild_db, eller hör av dig så lägger vi till stöd.`,
      );
    }

    const presentTables: SupportedTable[] = [];
    const tableColumns = new Map<SupportedTable, string[]>();
    const missingOptionalColumns: Record<string, string[]> = {};

    for (const table of SUPPORTED_TABLE_NAMES) {
      if (!tables.has(table)) {
        continue;
      }
      const present = columnsOf(db, table);
      const spec = SUPPORTED_TABLES[table];

      const missingRequired = spec.required.filter(
        (column) => !present.includes(column),
      );
      if (missingRequired.length > 0) {
        reject(
          "missing_required_column",
          `Tabellen ${table} saknar kolumner som Formkurvan behöver. Kör om GarminDB med --rebuild_db.`,
        );
      }

      const missingOptional = spec.optional.filter(
        (column) => !present.includes(column),
      );
      if (missingOptional.length > 0) {
        missingOptionalColumns[table] = missingOptional;
      }

      presentTables.push(table);
      tableColumns.set(table, present);
    }

    if (presentTables.length === 0) {
      reject(
        "missing_required_table",
        "Databasen innehåller ingen sömn-, vikt-, puls- eller dagsdata att importera.",
      );
    }

    const provenance: GarminDbProvenance = {
      database: "garmin",
      schemaVersion: version,
      tableVersions: readTableVersions(db),
      presentTables,
      missingOptionalColumns,
      rowCounts: {},
    };

    let totalRows = 0;
    let closed = false;

    return {
      provenance,
      measurementSystemRaw: scalar(db, MEASUREMENT_SYSTEM_SQL),
      readTable(table) {
        if (closed) {
          throw new Error("GarminDB reader is closed");
        }
        if (now() > deadline) {
          reject(
            "time_budget_exceeded",
            "Importen tog för lång tid och avbröts. Försök igen.",
          );
        }
        const present = tableColumns.get(table);
        if (!present) {
          return [];
        }

        const { columns, values } = execRows(
          db,
          buildTableSelect(table, present),
        );

        if (values.length >= MAX_ROWS_PER_TABLE) {
          reject(
            "row_budget_exceeded",
            `Tabellen ${table} innehåller fler än ${MAX_ROWS_PER_TABLE} rader. Dela upp exporten.`,
          );
        }
        totalRows += values.length;
        if (totalRows > MAX_ROWS_PER_IMPORT) {
          reject(
            "row_budget_exceeded",
            "Databasen innehåller för mycket data för en import. Dela upp exporten.",
          );
        }

        provenance.rowCounts[table] = values.length;

        return values.map((row) => {
          const record: TableRow = {};
          columns.forEach((column, index) => {
            const cell = row[index];
            record[column] =
              cell === null || cell === undefined
                ? null
                : cell instanceof Uint8Array
                  ? null
                  : cell;
          });
          return record;
        });
      },
      close() {
        if (!closed) {
          closed = true;
          db.close();
        }
      },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
