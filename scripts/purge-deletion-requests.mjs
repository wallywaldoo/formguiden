#!/usr/bin/env node
/**
 * Purge account deletion requests whose grace period has expired.
 *
 * Requires NHOST_SUBDOMAIN, NHOST_REGION, NHOST_ADMIN_SECRET.
 * Optional DATABASE_URL — when set, runs psql to delete auth.users (CASCADE public rows).
 *
 * Usage:
 *   node scripts/purge-deletion-requests.mjs
 *   node scripts/purge-deletion-requests.mjs --dry-run
 */

import { execFileSync } from "node:child_process";
import process from "node:process";

const dryRun = process.argv.includes("--dry-run");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function graphqlUrl(subdomain, region) {
  return `https://${subdomain}.${region}.nhost.run/v1/graphql`;
}

async function adminGraphql(subdomain, region, adminSecret, query, variables) {
  const response = await fetch(graphqlUrl(subdomain, region), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (body.errors?.length) {
    throw new Error(body.errors[0]?.message ?? "GraphQL failed");
  }
  return body.data;
}

const LIST_DUE = /* GraphQL */ `
  query DueDeletions($now: timestamptz!) {
    account_deletion_requests(
      where: { status: { _eq: "pending" }, purge_after: { _lte: $now } }
    ) {
      id
      user_id
    }
  }
`;

const LIST_USER_FILES = /* GraphQL */ `
  query UserFiles($userId: uuid!) {
    files(where: { uploaded_by_user_id: { _eq: $userId } }) {
      id
    }
  }
`;

const DELETE_FILES = /* GraphQL */ `
  mutation DeleteFiles($ids: [uuid!]!) {
    delete_files(where: { id: { _in: $ids } }) {
      affected_rows
    }
  }
`;

const MARK_PURGED = /* GraphQL */ `
  mutation MarkPurged($id: uuid!, $purged_at: timestamptz!) {
    update_account_deletion_requests_by_pk(
      pk_columns: { id: $id }
      _set: { status: "purged", purged_at: $purged_at }
    ) {
      id
    }
  }
`;

async function purgeAuthUser(databaseUrl, userId) {
  execFileSync(
    "psql",
    [
      databaseUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `DELETE FROM auth.refresh_tokens WHERE user_id = '${userId}'; DELETE FROM auth.users WHERE id = '${userId}';`,
    ],
    { stdio: "inherit" },
  );
}

async function main() {
  const subdomain = requireEnv("NHOST_SUBDOMAIN");
  const region = requireEnv("NHOST_REGION");
  const adminSecret = requireEnv("NHOST_ADMIN_SECRET");
  const databaseUrl = process.env.DATABASE_URL;
  const now = new Date().toISOString();

  const due = await adminGraphql(subdomain, region, adminSecret, LIST_DUE, {
    now,
  });
  const requests = due.account_deletion_requests ?? [];

  if (requests.length === 0) {
    console.log("No deletion requests due.");
    return;
  }

  console.log(`Found ${requests.length} due request(s).`);
  for (const request of requests) {
    console.log(`User ${request.user_id} (request ${request.id})`);
    if (dryRun) {
      continue;
    }

    const files = await adminGraphql(
      subdomain,
      region,
      adminSecret,
      LIST_USER_FILES,
      { userId: request.user_id },
    );
    const ids = (files.files ?? []).map((file) => file.id);
    if (ids.length > 0) {
      await adminGraphql(subdomain, region, adminSecret, DELETE_FILES, { ids });
    }

    if (databaseUrl) {
      purgeAuthUser(databaseUrl, request.user_id);
    } else {
      console.warn(
        "DATABASE_URL not set — public rows may remain until auth.users is removed manually.",
      );
    }

    await adminGraphql(subdomain, region, adminSecret, MARK_PURGED, {
      id: request.id,
      purged_at: now,
    });
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
