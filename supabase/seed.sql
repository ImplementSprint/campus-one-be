-- Campus One sandbox seed.
-- Use only for local/sandbox projects.

INSERT INTO public.institution_profiles (
  id,
  name,
  representative,
  email,
  contact_number,
  school_type,
  target_subdomain,
  status,
  setup_progress
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Demo School',
  'Demo Owner',
  'owner@demo.edu',
  '+630000000000',
  'College',
  'demo',
  'approved',
  100
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  target_subdomain = EXCLUDED.target_subdomain,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO public.admin_users (
  id,
  institution_id,
  email,
  password_hash,
  name,
  role,
  is_active
) VALUES
  ('10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'owner@demo.edu', 'seed-only', 'Demo Owner', 'admin', true),
  ('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'registrar@demo.edu', 'seed-only', 'Demo Registrar', 'admin', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.applicant_profiles (
  id,
  institution_id,
  email,
  first_name,
  last_name,
  full_name,
  school_level,
  applicant_type,
  program,
  status,
  reference_number,
  applicant_number
) VALUES (
  '10000000-0000-0000-0000-000000000020',
  '10000000-0000-0000-0000-000000000001',
  'applicant@demo.edu',
  'Demo',
  'Applicant',
  'Demo Applicant',
  'College',
  'New Student',
  'BS Information Technology',
  'Under Review',
  'DEMO-APP-001',
  'APP-2026-0001'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO public.student_accounts (
  id,
  institution_id,
  applicant_id,
  student_number,
  email,
  password_hash,
  enrollment_status,
  is_active
) VALUES (
  '10000000-0000-0000-0000-000000000030',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000020',
  '2026-0001',
  'student@demo.edu',
  'seed-only',
  'active',
  true
) ON CONFLICT (email) DO NOTHING;

INSERT INTO public.professor_users (
  id,
  institution_id,
  email,
  password_hash,
  full_name,
  department,
  employee_id
) VALUES (
  '10000000-0000-0000-0000-000000000040',
  '10000000-0000-0000-0000-000000000001',
  'professor@demo.edu',
  'seed-only',
  'Demo Professor',
  'College of Computing',
  'EMP-0001'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO public.alumni (
  id,
  institution_id,
  email,
  password_hash,
  name,
  student_number,
  graduation_year,
  program,
  is_active
) VALUES (
  '10000000-0000-0000-0000-000000000050',
  '10000000-0000-0000-0000-000000000001',
  'alumni@demo.edu',
  'seed-only',
  'Demo Alumni',
  '2019-0001',
  2019,
  'BS Information Technology',
  true
) ON CONFLICT (email) DO NOTHING;

INSERT INTO public.subjects (
  id,
  institution_id,
  code,
  name,
  description,
  units,
  semester,
  school_year,
  is_active
) VALUES (
  '10000000-0000-0000-0000-000000000060',
  '10000000-0000-0000-0000-000000000001',
  'IT101',
  'Introduction to Information Technology',
  'Sandbox subject',
  3,
  '1st Semester',
  '2026-2027',
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO public.tenant_user_memberships (
  institution_id,
  user_id,
  email,
  role,
  status
) VALUES
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', 'owner@demo.edu', 'school_owner', 'active'),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 'registrar@demo.edu', 'registrar', 'active'),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000020', 'applicant@demo.edu', 'applicant', 'active'),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000030', 'student@demo.edu', 'student', 'active'),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000040', 'professor@demo.edu', 'professor', 'active'),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000050', 'alumni@demo.edu', 'alumni', 'active')
ON CONFLICT (institution_id, user_id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  updated_at = NOW();
