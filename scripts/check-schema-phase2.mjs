import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(repoRoot, 'supabase', 'schema.sql');
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
const ownershipPath = path.join(repoRoot, 'docs', 'database-ownership.md');
const migrationGuidePath = path.join(repoRoot, 'docs', 'database-migrations.md');
const seedPath = path.join(repoRoot, 'supabase', 'seed.sql');

const schema = readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');

const tenantScopedTables = [
  'admin_users',
  'applicant_profiles',
  'academic_background',
  'alumni_relatives',
  'parent_information',
  'program_selections',
  'applicant_documents',
  'admissions_results',
  'admissions_activity_logs',
  'testing_centers',
  'exam_schedules',
  'exam_registrations',
  'exam_logs',
  'exam_scores',
  'reschedule_requests',
  'fee_configuration',
  'payment_transactions',
  'guidelines',
  'student_accounts',
  'professor_users',
  'subjects',
  'curriculum',
  'class_assignments',
  'class_enrollments',
  'grades',
  'grade_history',
  'announcements',
  'subject_offerings',
  'enrollments',
  'enrollment_items',
  'alumni',
  'notifications',
  'institution_resources',
];

const tenantFkTables = tenantScopedTables.filter((table) => table !== 'institution_resources');
const rlsTables = [
  'portal_accounts',
  'super_admins',
  'institution_profiles',
  'tenant_user_memberships',
  ...tenantScopedTables,
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function tableBody(table) {
  const match = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(([^;]+)\\);`, 's'));
  return match?.[1] ?? '';
}

if (!existsSync(ownershipPath)) {
  fail('Missing docs/database-ownership.md.');
} else {
  const ownership = readFileSync(ownershipPath, 'utf8');
  for (const table of tenantScopedTables) {
    if (!ownership.includes(`public.${table}`)) {
      fail(`Missing ownership entry for public.${table}.`);
    }
  }
}

if (!existsSync(migrationGuidePath)) {
  fail('Missing docs/database-migrations.md.');
}

if (!existsSync(seedPath)) {
  fail('Missing supabase/seed.sql.');
}

const migrationFiles = existsSync(migrationsDir)
  ? readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()
  : [];

if (migrationFiles.length === 0) {
  fail('Missing ordered Supabase migration SQL files.');
}

for (const file of ['schema-portal.sql', 'schema-portal-backup.sql']) {
  const content = readFileSync(path.join(repoRoot, 'supabase', file), 'utf8');
  if (!content.includes('REFERENCE ONLY')) {
    fail(`supabase/${file} must be marked REFERENCE ONLY.`);
  }
}

for (const table of tenantScopedTables) {
  const body = tableBody(table);
  if (!body.includes('institution_id')) {
    fail(`public.${table} is tenant-scoped but has no institution_id column.`);
  }
}

for (const table of tenantFkTables) {
  const body = tableBody(table);
  if (!body.includes('REFERENCES public.institution_profiles')) {
    fail(`public.${table} has institution_id but no institution_profiles foreign key.`);
  }
}

for (const table of tenantScopedTables) {
  if (!schema.includes(`CREATE INDEX IF NOT EXISTS ${table}_institution_idx`)) {
    fail(`Missing tenant index ${table}_institution_idx.`);
  }
}

for (const table of rlsTables) {
  if (!schema.includes(`ALTER TABLE public.${table}`) || !schema.includes(`ENABLE ROW LEVEL SECURITY`)) {
    fail(`Missing RLS enablement for public.${table}.`);
  }
}

if (!schema.includes('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon')) {
  fail('Missing default anon revoke for backend-only public schema tables.');
}

if (!schema.includes('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated')) {
  fail('Missing default authenticated revoke for backend-only public schema tables.');
}

if (!schema.includes('GRANT USAGE ON SCHEMA public TO authenticated')) {
  fail('Missing authenticated schema usage grant.');
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('Phase 2 schema checks passed.');
