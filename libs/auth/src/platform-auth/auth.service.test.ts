import { deepEqual, equal, rejects } from 'node:assert/strict';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService, getBearerToken } from './auth.service';

equal(getBearerToken('Bearer token-123'), 'token-123');
equal(getBearerToken('bearer token-456'), 'token-456');
equal(getBearerToken(undefined), null);
equal(getBearerToken('Basic token-123'), null);
equal(getBearerToken('Bearer '), null);

function createAdminClient() {
  return {
    auth: {
      getUser: async (token: string) => ({
        data: { user: { id: 'user-123', email: token === 'valid-token' ? 'student@example.edu' : undefined } },
        error: token === 'valid-token' ? null : { message: 'invalid token' },
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  };
}

function createIdentityAccessRepository(role: string | null, membership: any, error?: Error) {
  return {
    detectRoleByEmail: async () => {
      if (error) throw error;
      return role;
    },
    findActiveTenantMembership: async () => {
      if (error) throw error;
      return membership;
    },
  };
}

async function run() {
  const studentService = AuthService.forClients({ auth: { signOut: async () => ({}) } }, createAdminClient(), createIdentityAccessRepository('student', {
    institution_id: 'institution-123',
    institutionId: 'institution-123',
    role: 'student',
    status: 'active',
  }));
  const currentStudent = await studentService.getCurrentUser('Bearer valid-token', {
    institutionId: 'institution-123',
    schoolSlug: 'demo',
    isPlatformRoute: false,
    source: 'subdomain',
    resolvedInstitution: {
      id: 'institution-123',
      schoolSlug: 'demo',
      status: 'approved',
      name: 'Demo School',
    },
  });
  equal(currentStudent.user.id, 'user-123');
  equal(currentStudent.user.email, 'student@example.edu');
  equal(currentStudent.user.role, 'student');
  deepEqual(currentStudent.user.permissions, [
    'tenant.bootstrap.read',
    'academics.read',
    'enrollment.self.write',
    'grades.self.read',
    'payments.self.read',
    'notifications.self.read',
    'files.self.write',
  ]);
  deepEqual(currentStudent.user.activeInstitution, {
    id: 'institution-123',
    schoolSlug: 'demo',
    status: 'approved',
    name: 'Demo School',
  });
  equal(currentStudent.user.tenantMembership.status, 'verified');

  const adminService = AuthService.forClients({ auth: { signOut: async () => ({}) } }, createAdminClient(), createIdentityAccessRepository('school_admin', null));
  const currentAdmin = await adminService.getCurrentUser('Bearer valid-token');
  equal(currentAdmin.user.role, 'school_admin');

  const missingMembershipService = AuthService.forClients(
    { auth: { signOut: async () => ({}) } },
    createAdminClient(),
    createIdentityAccessRepository('student', null),
  );
  await rejects(
    () => missingMembershipService.getCurrentUser('Bearer valid-token', {
      institutionId: 'institution-123',
      schoolSlug: 'demo',
      isPlatformRoute: false,
      source: 'subdomain',
      resolvedInstitution: {
        id: 'institution-123',
        schoolSlug: 'demo',
        status: 'approved',
      },
    }),
    ForbiddenException,
  );

  await rejects(() => studentService.getCurrentUser(undefined), UnauthorizedException);
  await rejects(() => studentService.getCurrentUser('Bearer invalid-token'), UnauthorizedException);

  const noRoleService = AuthService.forClients({ auth: { signOut: async () => ({}) } }, createAdminClient(), createIdentityAccessRepository(null, null));
  await rejects(() => noRoleService.getCurrentUser('Bearer valid-token'), UnauthorizedException);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
