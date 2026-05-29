import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { strictEqual, ok, rejects } from 'node:assert/strict';
import { AUTH_ACCOUNT_LOOKUP_SQL, AuthService, type AuthRepository, type StoredAccount } from './auth.service';

class MemoryAuthRepository implements AuthRepository {
  private readonly accounts = new Map<string, StoredAccount>();

  async findAccountByEmail(email: string): Promise<StoredAccount | null> {
    return this.accounts.get(email) ?? null;
  }

  async createPortalAccount(account: StoredAccount): Promise<void> {
    if (this.accounts.has(account.email)) {
      throw new Error('duplicate account');
    }
    this.accounts.set(account.email, account);
  }
}

async function main() {
  delete process.env.CAMPUS_ONE_AUTH_SECRET;
  process.env.JWT_ACCESS_TOKEN_SECRET = 'test-secret-with-enough-length';

  const repository = new MemoryAuthRepository();
  const auth = new AuthService(repository);

  ok(AUTH_ACCOUNT_LOOKUP_SQL.includes('tenant_user_memberships'));
  ok(AUTH_ACCOUNT_LOOKUP_SQL.includes('coalesce(soa.institution_id, tum.institution_id)'));
  ok(AUTH_ACCOUNT_LOOKUP_SQL.includes("tum.status = 'active'"));

  const signup = await auth.signUp({
    email: ' Admin@CampusOne.test ',
    password: 'correct-password',
  });

  strictEqual(signup.user.email, 'admin@campusone.test');

  const stored = await repository.findAccountByEmail('admin@campusone.test');
  ok(stored);
  ok(stored.passwordHash.startsWith('scrypt$'));

  await rejects(
    () => auth.signUp({ email: 'admin@campusone.test', password: 'correct-password' }),
    ConflictException,
  );

  await rejects(
    () => auth.login({ email: 'admin@campusone.test', password: 'wrong-password' }),
    UnauthorizedException,
  );

  const login = await auth.login({
    email: 'ADMIN@CampusOne.test',
    password: 'correct-password',
  });

  strictEqual(login.user.email, 'admin@campusone.test');
  strictEqual(login.user.role, 'super_admin');
  strictEqual(login.user.permissions?.includes('platform.schools.review'), true);
  strictEqual(login.user.activeInstitutionId, null);
  ok(login.session.access_token);
  strictEqual(login.session.refresh_token, '');

  const currentUser = await auth.verifyAccessToken(login.session.access_token);
  strictEqual(currentUser.email, 'admin@campusone.test');
  strictEqual(currentUser.role, 'super_admin');
  strictEqual(currentUser.permissions.includes('platform.schools.review'), true);
  strictEqual(currentUser.activeInstitutionId, null);

  await repository.createPortalAccount({
    id: 'owner-1',
    email: 'owner@school.test',
    passwordHash: stored.passwordHash,
    role: 'school_owner',
    activeInstitutionId: 'school-1',
  });

  const ownerLogin = await auth.login({
    email: 'owner@school.test',
    password: 'correct-password',
  });

  strictEqual(ownerLogin.user.role, 'school_owner');
  strictEqual(ownerLogin.user.activeInstitutionId, 'school-1');
  strictEqual(ownerLogin.user.permissions?.includes('school.settings.manage'), true);

  await rejects(
    () => auth.verifyAccessToken('not-a-valid.access-token.signature'),
    UnauthorizedException,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
