import { deepEqual, equal } from 'node:assert/strict';
import { IdentityAccessRepository } from './identity-access.repository';

class FakeIdentityAccessClient {
  receivedArgs: any;
  lookups: string[] = [];
  roleTable: string | null = null;

  tenantUserMembership = {
    findFirst: async (args: any) => {
      this.receivedArgs = args;
      return {
        institutionId: 'institution-123',
        role: 'student',
        status: 'active',
      };
    },
  };

  portalAccount = this.roleLookup('portalAccount', { id: 'portal-123' });
  adminUser = this.roleLookup('adminUser', { role: 'school_admin' });
  studentAccount = this.roleLookup('studentAccount', { id: 'student-123' });
  professorUser = this.roleLookup('professorUser', { id: 'professor-123' });
  alumniAccount = this.roleLookup('alumniAccount', { id: 'alumni-123' });

  roleLookup(name: string, row: any) {
    return {
      findUnique: async (args: any) => {
        this.lookups.push(`${name}:${args.where.email}`);
        return this.roleTable === name ? row : null;
      },
    };
  }
}

async function run() {
  const client = new FakeIdentityAccessClient();
  const repository = IdentityAccessRepository.forClient(client as any);

  const result = await repository.findActiveTenantMembership(
    'user-123',
    'institution-123',
  );

  equal(result?.role, 'student');
  deepEqual(client.receivedArgs, {
    where: {
      userId: 'user-123',
      institutionId: 'institution-123',
      status: 'active',
    },
    select: {
      institutionId: true,
      role: true,
      status: true,
    },
  });

  client.roleTable = 'studentAccount';
  const studentRole = await repository.detectRoleByEmail(' STUDENT@EXAMPLE.EDU ');
  equal(studentRole, 'student');
  deepEqual(client.lookups, [
    'portalAccount:student@example.edu',
    'adminUser:student@example.edu',
    'studentAccount:student@example.edu',
  ]);

  client.lookups = [];
  client.roleTable = 'adminUser';
  equal(await repository.detectRoleByEmail('admin@example.edu'), 'school_admin');

  client.lookups = [];
  client.roleTable = null;
  equal(await repository.detectRoleByEmail('missing@example.edu'), null);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
