import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { serviceSchemas } from "./schema-list.mjs";

let failed = false;

function fail(message) {
  console.error(`[prisma:migrations:check] ${message}`);
  failed = true;
}

function serviceOwnsModels(schemaPath) {
  const content = readFileSync(schemaPath, "utf8");
  return /^model\s+\w+\s+\{/m.test(content);
}

for (const service of serviceSchemas) {
  if (!existsSync(service.schema)) {
    fail(`Missing schema for ${service.name}: ${service.schema}`);
    continue;
  }

  if (!serviceOwnsModels(service.schema)) {
    continue;
  }

  const migrationsDir = path.join(path.dirname(service.schema), "migrations");
  if (!existsSync(migrationsDir)) {
    fail(`Missing migrations directory for ${service.name}: ${migrationsDir}`);
    continue;
  }

  const migrationFiles = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(migrationsDir, entry.name, "migration.sql"))
    .filter((migrationPath) => existsSync(migrationPath));

  if (migrationFiles.length === 0) {
    fail(`Missing migration.sql files for ${service.name}: ${migrationsDir}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("[prisma:migrations:check] Prisma-owned service migrations are present.");
