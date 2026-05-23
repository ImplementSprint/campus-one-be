import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = path.join(repoRoot, 'contract-artifacts');
const catalogPath = path.join(artifactDir, 'route-catalog.json');
const manifestPath = path.join(artifactDir, 'route-catalog-manifest.json');
const checkOnly = process.argv.includes('--check');

const httpDecorators = ['Get', 'Post', 'Put', 'Patch', 'Delete'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function walk(dir, matcher, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, matcher, results);
    } else if (matcher(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function normalizeSlash(value) {
  return value.replace(/\\/g, '/');
}

function relativePath(filePath) {
  return normalizeSlash(path.relative(repoRoot, filePath));
}

function parseDecoratorString(args) {
  const match = args.match(/['"`]([^'"`]*)['"`]/);
  return match?.[1] ?? '';
}

function parsePermissions(block) {
  const matches = [...block.matchAll(/@RequirePermissions\(([^)]*)\)/g)];
  return matches.flatMap((match) =>
    [...match[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((permission) => permission[1]),
  );
}

function ownerFromFile(file) {
  const normalized = normalizeSlash(file);
  if (normalized.includes('/libs/auth/')) return 'identity-access';
  if (normalized.includes('/libs/tenants/')) return 'tenant-registry';
  if (normalized.includes('/libs/admissions/')) return 'admissions';
  if (normalized.includes('/libs/academics/')) return 'academics';
  if (normalized.includes('/libs/alumni/')) return 'alumni';
  if (normalized.includes('/libs/institution-data/')) return 'institution-data';
  if (normalized.includes('/apps/gateway/')) return 'gateway';
  return 'unknown';
}

function routeScope({ route, isPublic, permissions }) {
  if (route === '/api/health') return 'health';
  if (isPublic) return 'public';
  if (permissions.some((permission) => permission.startsWith('platform.'))) return 'platform';
  if (permissions.length > 0) return 'tenant';
  return 'authenticated';
}

function accessLevel({ isPublic, permissions }) {
  if (isPublic) return 'public';
  if (permissions.length > 0) return 'permission';
  return 'authenticated';
}

function joinRoute(prefix, basePath, methodPath) {
  const parts = [prefix, basePath, methodPath]
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => String(part).replace(/^\/+|\/+$/g, ''));
  return `/${parts.join('/')}`.replace(/\/+/g, '/');
}

function parseController(filePath) {
  const source = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const controllerMatch = source.match(/@Controller\(([^)]*)\)\s*(?:@[A-Za-z]+\([^)]*\)\s*)*export\s+class\s+(\w+)/s);
  if (!controllerMatch) return [];

  const basePath = parseDecoratorString(controllerMatch[1]);
  const className = controllerMatch[2];
  const classPrefix = source.slice(0, controllerMatch.index);
  const classIsPublic = /@Public\(\)/.test(classPrefix) || /@Controller\([^)]*\)\s*@Public\(\)/s.test(source);

  const routeRegex = new RegExp(
    `((?:\\s*@(?:${httpDecorators.join('|')}|Public|RequirePermissions|HttpCode)\\([^\\n]*\\)\\s*)+)\\s*(?:async\\s+)?(\\w+)\\s*\\(`,
    'g',
  );

  const routes = [];
  for (const match of source.matchAll(routeRegex)) {
    const decoratorBlock = match[1];
    const methodName = match[2];
    const httpMatch = decoratorBlock.match(new RegExp(`@(${httpDecorators.join('|')})\\(([^)]*)\\)`));
    if (!httpMatch) continue;

    const methodPath = parseDecoratorString(httpMatch[2]);
    const method = httpMatch[1].toUpperCase();
    const permissions = parsePermissions(decoratorBlock);
    const isPublic = classIsPublic || /@Public\(\)/.test(decoratorBlock);
    const route = joinRoute('api', basePath, methodPath);

    routes.push({
      method,
      route,
      owner: ownerFromFile(filePath),
      controller: className,
      handler: methodName,
      access: accessLevel({ isPublic, permissions }),
      scope: routeScope({ route, isPublic, permissions }),
      permissions,
      source: relativePath(filePath),
    });
  }

  return routes;
}

const controllerFiles = [
  ...walk(path.join(repoRoot, 'apps'), (file) => file.endsWith('.controller.ts')),
  ...walk(path.join(repoRoot, 'libs'), (file) => file.endsWith('.controller.ts')),
].sort((a, b) => relativePath(a).localeCompare(relativePath(b)));

const routes = controllerFiles
  .flatMap(parseController)
  .sort((a, b) => `${a.route} ${a.method}`.localeCompare(`${b.route} ${b.method}`));

const catalog = {
  formatVersion: 1,
  generatedFrom: ['apps/**/*.controller.ts', 'libs/**/*.controller.ts'],
  globalPrefix: '/api',
  routeCount: routes.length,
  routes,
};

const catalogJson = `${JSON.stringify(catalog, null, 2)}\n`;
const manifest = {
  artifact: 'contract-artifacts/route-catalog.json',
  formatVersion: 1,
  routeCount: routes.length,
  sha256: createHash('sha256').update(catalogJson).digest('hex'),
  sources: controllerFiles.map(relativePath),
};
const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

if (checkOnly) {
  const currentCatalog = readFileSync(catalogPath, 'utf8').replace(/\r\n/g, '\n');
  const currentManifest = readFileSync(manifestPath, 'utf8').replace(/\r\n/g, '\n');
  if (currentCatalog !== catalogJson) fail('Route catalog is stale. Run `npm run routes:generate`.');
  if (currentManifest !== manifestJson) fail('Route catalog manifest is stale. Run `npm run routes:generate`.');
  console.log(`Route catalog is current (${manifest.routeCount} routes, ${manifest.sha256}).`);
  process.exit(0);
}

mkdirSync(artifactDir, { recursive: true });
writeFileSync(catalogPath, catalogJson, 'utf8');
writeFileSync(manifestPath, manifestJson, 'utf8');
console.log(`Generated route catalog (${manifest.routeCount} routes, ${manifest.sha256}).`);
