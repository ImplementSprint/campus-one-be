import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(repoRoot, 'libs/contracts/src/index.ts');
const artifactDir = path.join(repoRoot, 'contract-artifacts');
const artifactPath = path.join(artifactDir, 'shared-contracts.ts');
const manifestPath = path.join(artifactDir, 'contracts-manifest.json');
const checkOnly = process.argv.includes('--check');

const source = readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n').trim();
const artifact = [
  '// Generated from campus-one-backend/libs/contracts/src/index.ts.',
  '// Do not edit by hand; run `npm run contracts:generate` in campus-one-backend.',
  '',
  source,
  '',
].join('\n');

const manifest = {
  artifact: 'contract-artifacts/shared-contracts.ts',
  formatVersion: 1,
  sha256: createHash('sha256').update(artifact).digest('hex'),
  source: 'libs/contracts/src/index.ts',
};
const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (checkOnly) {
  const currentArtifact = readFileSync(artifactPath, 'utf8').replace(/\r\n/g, '\n');
  const currentManifest = readFileSync(manifestPath, 'utf8').replace(/\r\n/g, '\n');
  if (currentArtifact !== artifact) fail('Contract artifact is stale. Run `npm run contracts:generate`.');
  if (currentManifest !== manifestJson) fail('Contract manifest is stale. Run `npm run contracts:generate`.');
  console.log(`Contract artifact is current (${manifest.sha256}).`);
  process.exit(0);
}

mkdirSync(artifactDir, { recursive: true });
writeFileSync(artifactPath, artifact, 'utf8');
writeFileSync(manifestPath, manifestJson, 'utf8');
console.log(`Generated contract artifact ${manifest.sha256}.`);
