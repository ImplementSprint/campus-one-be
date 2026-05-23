import { deepEqual, equal } from 'node:assert/strict';
import { TenantRegistryRepository } from './tenant-registry.repository';

class FakeTenantRegistryClient {
  receivedArgs: any;
  receivedManyArgs: any;

  institutionProfile = {
    findFirst: async (args: any) => {
      this.receivedArgs = args;
      return {
        id: 'institution-123',
        name: 'Demo School',
        targetSubdomain: 'demo',
        schoolType: 'University',
        status: 'approved',
      };
    },
    findMany: async (args: any) => {
      this.receivedManyArgs = args;
      return [
        {
          id: 'institution-123',
          name: 'Demo School',
          targetSubdomain: 'demo',
          schoolType: 'University',
          status: 'approved',
        },
      ];
    },
  };
}

async function run() {
  const client = new FakeTenantRegistryClient();
  const repository = TenantRegistryRepository.forClient(client as any);

  const result = await repository.findInstitutionForTenant({
    schoolSlug: 'demo',
    institutionId: 'institution-123',
  });

  equal(result?.id, 'institution-123');
  deepEqual(client.receivedArgs, {
    where: {
      targetSubdomain: 'demo',
      id: 'institution-123',
    },
    select: {
      id: true,
      name: true,
      targetSubdomain: true,
      status: true,
    },
  });

  const schools = await repository.searchApprovedInstitutions('de%_mo');
  equal(schools.length, 1);
  deepEqual(client.receivedManyArgs, {
    where: {
      status: 'approved',
      OR: [
        { name: { contains: 'demo', mode: 'insensitive' } },
        { targetSubdomain: { contains: 'demo', mode: 'insensitive' } },
      ],
    },
    orderBy: {
      name: 'asc',
    },
    take: 25,
    select: {
      id: true,
      name: true,
      targetSubdomain: true,
      schoolType: true,
      status: true,
    },
  });

  await repository.findApprovedInstitutionBySlug('demo');
  deepEqual(client.receivedArgs, {
    where: {
      targetSubdomain: 'demo',
      status: 'approved',
    },
    select: {
      id: true,
      name: true,
      targetSubdomain: true,
      schoolType: true,
      status: true,
    },
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
