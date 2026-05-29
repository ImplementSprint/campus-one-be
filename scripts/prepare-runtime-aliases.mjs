import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseAliasDir = join(root, 'dist', 'node_modules', '@campus-one', 'database');
const databasePrismaAliasDir = join(databaseAliasDir, 'prisma');

mkdirSync(databaseAliasDir, { recursive: true });
mkdirSync(databasePrismaAliasDir, { recursive: true });
writeFileSync(
  join(databaseAliasDir, 'supabase.js'),
  "module.exports = require('../../../libs/database/src/supabase.js');\n",
);
writeFileSync(
  join(databasePrismaAliasDir, 'tenant-registry-prisma.client.js'),
  "module.exports = require('../../../../libs/database/src/prisma/tenant-registry-prisma.client.js');\n",
);
writeFileSync(
  join(databasePrismaAliasDir, 'identity-access-prisma.client.js'),
  "module.exports = require('../../../../libs/database/src/prisma/identity-access-prisma.client.js');\n",
);
