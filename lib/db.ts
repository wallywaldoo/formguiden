import postgres from "postgres";

// Single Vercel Postgres connection used by the entire app.
// Requires POSTGRES_URL env var (connection string with ?sslmode=require for production).
const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL environment variable is not set");
}

const sql = postgres(connectionString, {
  // Vercel Postgres uses SSL in production
  ssl: process.env.NODE_ENV === "production" ? "require" : false,
  // Keep pool small — single user, serverless functions
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;

// TODO [migration]: Replace all graphqlRequest() calls with direct sql`` queries.
