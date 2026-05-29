import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert/strict';
import {
  BETA_DEMO_ACCOUNTS,
  BETA_DEMO_IDS,
  buildPasswordConfig,
  seedBetaDemo,
} from './seed-beta-demo.mjs';

class FakePool {
  constructor(name) {
    this.name = name;
    this.queries = [];
    this.ended = false;
  }

  async query(text, values = []) {
    this.queries.push({ text: text.replace(/\s+/g, ' ').trim(), values });
    return { rows: [] };
  }

  async end() {
    this.ended = true;
  }
}

async function main() {
  throws(
    () => buildPasswordConfig({}),
    /Missing required beta seed password env vars/,
  );

  const passwords = buildPasswordConfig(
    Object.fromEntries(BETA_DEMO_ACCOUNTS.map((account) => [account.passwordEnv, `${account.role}-Password-2026!`])),
  );
  strictEqual(passwords.get('school_owner')?.startsWith('school_owner-Password'), true);

  const pools = {
    tenantRegistry: new FakePool('tenant_registry'),
    identityAccess: new FakePool('identity_access'),
  };

  const summary = await seedBetaDemo({
    pools,
    passwords,
    now: new Date('2026-05-25T00:00:00.000Z'),
  });

  strictEqual(summary.school.slug, 'demo');
  strictEqual(summary.accounts.length, BETA_DEMO_ACCOUNTS.length);
  deepStrictEqual(summary.accounts.map((account) => account.role), BETA_DEMO_ACCOUNTS.map((account) => account.role));
  ok(summary.accounts.every((account) => !('password' in account)));

  ok(pools.tenantRegistry.queries.some((query) => query.text.includes('insert into public.institution_profiles')));
  ok(pools.tenantRegistry.queries.some((query) => query.text.includes('insert into public.onboarding_progress')));
  ok(pools.tenantRegistry.queries.some((query) => query.text.includes('insert into public.audit_events')));
  ok(pools.identityAccess.queries.some((query) => query.text.includes('insert into public.portal_accounts')));
  ok(pools.identityAccess.queries.some((query) => query.text.includes('insert into public.super_admins')));
  ok(pools.identityAccess.queries.some((query) => query.text.includes('insert into public.school_owner_accounts')));
  ok(pools.identityAccess.queries.some((query) => query.text.includes('insert into public.tenant_user_memberships')));

  const tenantProfileQuery = pools.tenantRegistry.queries.find((query) => query.text.includes('insert into public.institution_profiles'));
  ok(tenantProfileQuery?.values.includes(BETA_DEMO_IDS.institutionId));

  const membershipQueries = pools.identityAccess.queries.filter((query) => query.text.includes('insert into public.tenant_user_memberships'));
  ok(membershipQueries.some((query) => query.values.includes('admissions_admin')));
  ok(membershipQueries.some((query) => query.values.includes('alumni_admin')));

  strictEqual(pools.tenantRegistry.ended, false);
  strictEqual(pools.identityAccess.ended, false);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
