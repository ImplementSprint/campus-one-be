import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { serviceSchemas } from "./schema-list.mjs";

const localPrismaCli = path.join(
  process.cwd(),
  "node_modules",
  "prisma",
  "build",
  "index.js",
);

const prismaCommand = existsSync(localPrismaCli)
  ? { bin: process.execPath, baseArgs: [localPrismaCli] }
  : { bin: "prisma", baseArgs: [] };

function placeholderDatabaseUrl(service) {
  return `postgresql://user:password@localhost:5432/${service.database}?schema=public`;
}

export function runForSchemas({ command, label, requireDatabaseUrl = false }) {
  for (const service of serviceSchemas) {
    if (!existsSync(service.schema)) {
      console.error(
        `[prisma:${label}] Missing schema for ${service.name}: ${service.schema}`,
      );
      process.exit(1);
    }

    const serviceDatabaseUrl = process.env[service.envVar];
    if (requireDatabaseUrl && !serviceDatabaseUrl) {
      console.error(
        `[prisma:${label}] Missing required ${service.envVar} for ${service.name}.`,
      );
      process.exit(1);
    }

    console.log(
      `[prisma:${label}] ${service.name} (${service.envVar}) -> ${service.schema}`,
    );

    const result = spawnSync(
      prismaCommand.bin,
      [...prismaCommand.baseArgs, ...command, "--schema", service.schema],
      {
        env: {
          ...process.env,
          DATABASE_URL: serviceDatabaseUrl ?? placeholderDatabaseUrl(service),
        },
        shell: false,
        stdio: "inherit",
      },
    );

    if (result.error) {
      console.error(
        `[prisma:${label}] Failed to start Prisma for ${service.name}: ${result.error.message}`,
      );
      process.exit(1);
    }

    if (result.status !== 0) {
      console.error(
        `[prisma:${label}] ${service.name} failed with exit code ${result.status}`,
      );
      process.exit(result.status ?? 1);
    }
  }

  console.log(`[prisma:${label}] Completed ${serviceSchemas.length} schema(s).`);
}
