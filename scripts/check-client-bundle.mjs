import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const staticDir = join(process.cwd(), ".next", "static");
const forbiddenNames = [
  "NHOST_ADMIN_SECRET",
  "HASURA_GRAPHQL_ADMIN_SECRET",
  "HASURA_GRAPHQL_JWT_SECRET",
  "NUTRITION_AI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
];
const forbiddenValues = [
  process.env.NHOST_ADMIN_SECRET,
  process.env.HASURA_GRAPHQL_ADMIN_SECRET,
].filter((value) => typeof value === "string" && value.length >= 8);

function walk(dir, files = []) {
  if (!existsSync(dir)) {
    return files;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(js|json|html)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(staticDir);

if (files.length === 0) {
  console.error(
    "No client bundle files found under .next/static. Run `next build` first.",
  );
  process.exit(1);
}

const hits = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const name of forbiddenNames) {
    if (text.includes(name)) {
      hits.push(`${name} in ${file}`);
    }
  }
  for (const value of forbiddenValues) {
    if (text.includes(value)) {
      hits.push(`secret value in ${file}`);
    }
  }
}

if (hits.length > 0) {
  console.error("Client bundle secret leak:\n" + hits.join("\n"));
  process.exit(1);
}

console.log(`Checked ${files.length} client files. No admin secret found.`);
