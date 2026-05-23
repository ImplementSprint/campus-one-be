import { readFileSync, writeFileSync } from 'node:fs';

const schemaPath = 'supabase/schema.sql';
const legacySchemaPaths = ['supabase/schema-portal.sql', 'supabase/schema-portal-backup.sql'];

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
];

let schema = readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');

for (const table of tenantScopedTables) {
  schema = schema.replace(
    new RegExp(`(CREATE TABLE IF NOT EXISTS public\\.${table} \\(\\n)`, 'g'),
    `$1  institution_id UUID        NOT NULL REFERENCES public.institution_profiles (id) ON DELETE CASCADE,\n`,
  );
}

schema = schema.replace(
  '  institution_id UUID        NOT NULL,\n  resource_type',
  '  institution_id UUID        NOT NULL REFERENCES public.institution_profiles (id) ON DELETE CASCADE,\n  resource_type',
);

const tenantIndexes = [
  '',
  '-- ---------------------------------------------------------------------------',
  '-- Tenant indexes and RLS posture',
  '-- ---------------------------------------------------------------------------',
  '',
  'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;',
  'GRANT USAGE ON SCHEMA public TO authenticated;',
  '',
  ...tenantScopedTables.flatMap((table) => [
    `CREATE INDEX IF NOT EXISTS ${table}_institution_idx`,
    `  ON public.${table} (institution_id);`,
    '',
  ]),
  'CREATE INDEX IF NOT EXISTS institution_resources_institution_idx',
  '  ON public.institution_resources (institution_id, resource_type);',
  '',
  ...tenantScopedTables.map((table) => `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
  'ALTER TABLE public.institution_resources ENABLE ROW LEVEL SECURITY;',
  '',
].join('\n');

schema = schema.replace(
  '-- =============================================================================\n-- SECTION 11: FUNCTIONS & TRIGGERS\n-- =============================================================================',
  `${tenantIndexes}-- =============================================================================\n-- SECTION 11: FUNCTIONS & TRIGGERS\n-- =============================================================================`,
);

schema = schema.replace(
  /CREATE INDEX IF NOT EXISTS institution_resources_institution_idx\n  ON public\.institution_resources \(institution_id, resource_type\);\n/g,
  '',
);

writeFileSync(schemaPath, schema, 'utf8');

for (const legacyPath of legacySchemaPaths) {
  const legacy = readFileSync(legacyPath, 'utf8').replace(/\r\n/g, '\n');
  if (!legacy.includes('REFERENCE ONLY')) {
    writeFileSync(
      legacyPath,
      [
        '-- REFERENCE ONLY: legacy portal schema snapshot.',
        '-- Do not use this file as an active migration source.',
        '',
        legacy,
      ].join('\n'),
      'utf8',
    );
  }
}
