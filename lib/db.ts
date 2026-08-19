import postgres from "postgres";

// Single Vercel Postgres connection used by the entire app.
// Requires POSTGRES_URL env var (connection string with ?sslmode=require for production).
// Use a lazy getter so this module can be imported at build time without a real DB URL.
// The connection is only established on the first actual query.

function createSql() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL environment variable is not set");
  }
  try {
    new URL(connectionString);
  } catch {
    throw new Error("POSTGRES_URL environment variable is invalid");
  }
  return postgres(connectionString, {
    // Vercel Postgres uses SSL in production
    ssl: process.env.NODE_ENV === "production" ? "require" : false,
    // Keep pool small — single user, serverless functions
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// Cached instance
let instance: ReturnType<typeof postgres> | undefined;

function getInstance() {
  if (!instance) {
    instance = createSql();
  }
  return instance;
}

// Tagged template literal wrapper that lazily creates the connection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = ((strings: TemplateStringsArray, ...values: any[]) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (getInstance() as any)(strings, ...values)) as ReturnType<typeof postgres>;

// Copy over any non-function properties the postgres client exposes
// so code like sql.begin(...) still works via property access
export default new Proxy(sql, {
  get(target, prop) {
    // Check own property of the wrapper first
    if (prop in target) {
      return (target as unknown as Record<string | symbol, unknown>)[prop];
    }
    // Fall through to the real postgres instance
    const inst = getInstance();
    const val = (inst as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof val === "function") {
      return val.bind(inst);
    }
    return val;
  },
});
