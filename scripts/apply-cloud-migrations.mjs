#!/usr/bin/env node
/**
 * Apply nhost/migrations and nhost/metadata to a linked Nhost cloud project.
 *
 * Requires:
 * - .secrets from `nhost config pull --subdomain <subdomain> --yes`
 * - NHOST_SUBDOMAIN and NHOST_REGION env vars (or pass as args)
 *
 * Usage:
 *   node scripts/apply-cloud-migrations.mjs bptuyirzwytjdwgdzwta eu-central-1
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const subdomain = process.argv[2] ?? process.env.NHOST_SUBDOMAIN;
const region = process.argv[3] ?? process.env.NHOST_REGION ?? "eu-central-1";

if (!subdomain) {
  console.error("Usage: node scripts/apply-cloud-migrations.mjs <subdomain> [region]");
  process.exit(1);
}

function readSecret(name) {
  const line = readFileSync(".secrets", "utf8")
    .split("\n")
    .find((row) => row.startsWith(`${name} `));
  const match = line?.match(/'([^']*)'/);
  if (!match?.[1]) {
    throw new Error(`Missing ${name} in .secrets — run nhost config pull first.`);
  }
  return match[1];
}

const adminSecret = readSecret("HASURA_GRAPHQL_ADMIN_SECRET");
const endpoint = `https://${subdomain}.hasura.${region}.nhost.run`;

const config = `version: 3
endpoint: ${endpoint}
admin_secret: ${adminSecret}
metadata_directory: nhost/metadata
migrations_directory: nhost/migrations
`;

writeFileSync("hasura-config.yaml", config);

try {
  console.log(`Applying migrations to ${endpoint} ...`);
  execFileSync(
    "npx",
    [
      "--yes",
      "hasura-cli@2.38.0",
      "migrate",
      "apply",
      "--database-name",
      "default",
      "--project",
      ".",
      "--config-path",
      "hasura-config.yaml",
    ],
    { stdio: "inherit" },
  );

  console.log("Applying metadata ...");
  execFileSync(
    "npx",
    [
      "--yes",
      "hasura-cli@2.38.0",
      "metadata",
      "apply",
      "--project",
      ".",
      "--config-path",
      "hasura-config.yaml",
    ],
    { stdio: "inherit" },
  );

  console.log("Migrations and metadata applied.");
} finally {
  try {
    execFileSync("rm", ["hasura-config.yaml"]);
  } catch {
    // ignore
  }
}
