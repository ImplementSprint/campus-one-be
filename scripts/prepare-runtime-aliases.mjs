import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseAliasDir = join(root, 'dist', 'node_modules', '@campus-one', 'database');

mkdirSync(databaseAliasDir, { recursive: true });
writeFileSync(
  join(databaseAliasDir, 'supabase.js'),
  "module.exports = require('../../../libs/database/src/supabase.js');\n",
);
