import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const BETA_DEMO_IDS = {
  institutionId: '10000000-0000-0000-0000-000000000001',
  superAdminId: '10000000-0000-0000-0000-000000000002',
  ownerId: '10000000-0000-0000-0000-000000000010',
  schoolAdminId: '10000000-0000-0000-0000-000000000011',
  admissionsAdminId: '10000000-0000-0000-0000-000000000012',
  registrarId: '10000000-0000-0000-0000-000000000013',
  professorId: '10000000-0000-0000-0000-000000000040',
  studentId: '10000000-0000-0000-0000-000000000030',
  applicantId: '10000000-0000-0000-0000-000000000020',
  alumniId: '10000000-0000-0000-0000-000000000050',
  alumniAdminId: '10000000-0000-0000-0000-000000000051',
};

export const BETA_DEMO_ACCOUNTS = [
  { role: 'super_admin', id: BETA_DEMO_IDS.superAdminId, email: 'superadmin@demo.itsandbox.site', passwordEnv: 'BETA_SEED_SUPER_ADMIN_PASSWORD' },
  { role: 'school_owner', id: BETA_DEMO_IDS.ownerId, email: 'owner@demo.itsandbox.site', passwordEnv: 'BETA_SEED_SCHOOL_OWNER_PASSWORD' },
  { role: 'school_admin', id: BETA_DEMO_IDS.schoolAdminId, email: 'schooladmin@demo.itsandbox.site', passwordEnv: 'BETA_SEED_SCHOOL_ADMIN_PASSWORD' },
  { role: 'admissions_admin', id: BETA_DEMO_IDS.admissionsAdminId, email: 'admissions@demo.itsandbox.site', passwordEnv: 'BETA_SEED_ADMISSIONS_ADMIN_PASSWORD' },
  { role: 'registrar', id: BETA_DEMO_IDS.registrarId, email: 'registrar@demo.itsandbox.site', passwordEnv: 'BETA_SEED_REGISTRAR_PASSWORD' },
  { role: 'professor', id: BETA_DEMO_IDS.professorId, email: 'professor@demo.itsandbox.site', passwordEnv: 'BETA_SEED_PROFESSOR_PASSWORD' },
  { role: 'student', id: BETA_DEMO_IDS.studentId, email: 'student@demo.itsandbox.site', passwordEnv: 'BETA_SEED_STUDENT_PASSWORD' },
  { role: 'applicant', id: BETA_DEMO_IDS.applicantId, email: 'applicant@demo.itsandbox.site', passwordEnv: 'BETA_SEED_APPLICANT_PASSWORD' },
  { role: 'alumni', id: BETA_DEMO_IDS.alumniId, email: 'alumni@demo.itsandbox.site', passwordEnv: 'BETA_SEED_ALUMNI_PASSWORD' },
  { role: 'alumni_admin', id: BETA_DEMO_IDS.alumniAdminId, email: 'alumniadmin@demo.itsandbox.site', passwordEnv: 'BETA_SEED_ALUMNI_ADMIN_PASSWORD' },
];

export function buildPasswordConfig(env = process.env) {
  const missing = BETA_DEMO_ACCOUNTS
    .filter((account) => !env[account.passwordEnv]?.trim())
    .map((account) => account.passwordEnv);

  if (missing.length > 0) {
    throw new Error(`Missing required beta seed password env vars: ${missing.join(', ')}`);
  }

  return new Map(BETA_DEMO_ACCOUNTS.map((account) => [account.role, env[account.passwordEnv].trim()]));
}

function hashPassword(password, salt = randomBytes(16).toString('base64url')) {
  const hash = scryptSync(password, salt, 64).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

function invitationTokenHash(seed = 'campus-one-demo-owner-invitation') {
  return createHash('sha256').update(seed).digest('hex');
}

async function upsertTenantRegistry(pool, now) {
  await pool.query(
    `
      insert into public.institution_profiles (
        id, name, representative, email, contact_number, school_type,
        target_subdomain, status, setup_progress, approved_at, approved_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'approved', 100, $8, $9)
      on conflict (id) do update set
        name = excluded.name,
        representative = excluded.representative,
        email = excluded.email,
        contact_number = excluded.contact_number,
        school_type = excluded.school_type,
        target_subdomain = excluded.target_subdomain,
        status = excluded.status,
        setup_progress = excluded.setup_progress,
        approved_at = coalesce(public.institution_profiles.approved_at, excluded.approved_at),
        approved_by = coalesce(public.institution_profiles.approved_by, excluded.approved_by),
        updated_at = now()
    `,
    [
      BETA_DEMO_IDS.institutionId,
      'Campus One Demo School',
      'Demo School Owner',
      'owner@demo.itsandbox.site',
      '+639000000000',
      'College',
      'demo',
      now,
      BETA_DEMO_IDS.superAdminId,
    ],
  );

  await pool.query(
    `
      insert into public.onboarding_progress (institution_id, current_step, progress)
      values ($1, 'owner_account_created', 100)
      on conflict (institution_id) do update set
        current_step = excluded.current_step,
        progress = excluded.progress,
        updated_at = now()
    `,
    [BETA_DEMO_IDS.institutionId],
  );

  await pool.query(
    `
      insert into public.school_owner_invitations (institution_id, email, token_hash, status, expires_at)
      values ($1, $2, $3, 'accepted', $4)
    `,
    [
      BETA_DEMO_IDS.institutionId,
      'owner@demo.itsandbox.site',
      invitationTokenHash(),
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    ],
  );

  await pool.query(
    `
      insert into public.audit_events (institution_id, actor_user_id, event_type, metadata, created_at)
      values
        ($1, $2, 'platform.school.approved', $3, $5),
        ($1, $4, 'platform.school.owner_account_created', $6, $5)
    `,
    [
      BETA_DEMO_IDS.institutionId,
      BETA_DEMO_IDS.superAdminId,
      JSON.stringify({ source: 'seed:beta-demo', schoolSlug: 'demo' }),
      BETA_DEMO_IDS.ownerId,
      now,
      JSON.stringify({ source: 'seed:beta-demo', next: 'tenant_portal_login' }),
    ],
  );
}

async function upsertIdentityAccess(pool, passwords) {
  for (const account of BETA_DEMO_ACCOUNTS) {
    await pool.query(
      `
        insert into public.portal_accounts (id, email, password_hash)
        values ($1, $2, $3)
        on conflict (email) do update set
          password_hash = excluded.password_hash,
          updated_at = now()
      `,
      [account.id, account.email, hashPassword(passwords.get(account.role))],
    );
  }

  const superAdmin = BETA_DEMO_ACCOUNTS.find((account) => account.role === 'super_admin');
  await pool.query(
    `
      insert into public.super_admins (id, email, role)
      values ($1, $2, 'super_admin')
      on conflict (id) do update set
        email = excluded.email,
        role = excluded.role,
        updated_at = now()
    `,
    [superAdmin.id, superAdmin.email],
  );

  const owner = BETA_DEMO_ACCOUNTS.find((account) => account.role === 'school_owner');
  await pool.query(
    `
      insert into public.school_owner_accounts (id, institution_id, email, role)
      values ($1, $2, $3, 'school_owner')
      on conflict (id) do update set
        institution_id = excluded.institution_id,
        email = excluded.email,
        updated_at = now()
    `,
    [owner.id, BETA_DEMO_IDS.institutionId, owner.email],
  );

  for (const account of BETA_DEMO_ACCOUNTS.filter((candidate) => candidate.role !== 'super_admin')) {
    await pool.query(
      `
        insert into public.tenant_user_memberships (institution_id, user_id, email, role, status)
        values ($1, $2, $3, $4, 'active')
        on conflict (institution_id, user_id) do update set
          email = excluded.email,
          role = excluded.role,
          status = excluded.status,
          updated_at = now()
      `,
      [BETA_DEMO_IDS.institutionId, account.id, account.email, account.role],
    );
  }
}

export async function seedBetaDemo({ pools, passwords, now = new Date() }) {
  await upsertTenantRegistry(pools.tenantRegistry, now);
  await upsertIdentityAccess(pools.identityAccess, passwords);

  return {
    school: {
      id: BETA_DEMO_IDS.institutionId,
      slug: 'demo',
      name: 'Campus One Demo School',
    },
    accounts: BETA_DEMO_ACCOUNTS.map(({ role, id, email }) => ({ role, id, email })),
  };
}

async function main() {
  const { Pool } = await import('pg');
  const tenantRegistryUrl = process.env.TENANT_REGISTRY_DATABASE_URL;
  const identityAccessUrl = process.env.IDENTITY_ACCESS_DATABASE_URL;
  if (!tenantRegistryUrl || !identityAccessUrl) {
    throw new Error('TENANT_REGISTRY_DATABASE_URL and IDENTITY_ACCESS_DATABASE_URL are required.');
  }

  const pools = {
    tenantRegistry: new Pool({ connectionString: tenantRegistryUrl }),
    identityAccess: new Pool({ connectionString: identityAccessUrl }),
  };

  try {
    const summary = await seedBetaDemo({ pools, passwords: buildPasswordConfig() });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await Promise.all([pools.tenantRegistry.end(), pools.identityAccess.end()]);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
