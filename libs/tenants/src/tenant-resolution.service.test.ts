import { equal, rejects } from 'node:assert/strict';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { TenantResolutionService } from './tenant-resolution.service';
import type { TenantContext } from './tenant-context';

class FakeTenantRegistryRepository {
  lookups: any[] = [];

  constructor(private readonly result: any, private readonly error?: Error) {
  }

  async findInstitutionForTenant(lookup: any) {
    this.lookups.push(lookup);
    if (this.error) {
      throw this.error;
    }
    return this.result;
  }
}

const baseContext: TenantContext = {
  schoolSlug: 'demo',
  source: 'subdomain',
  isPlatformRoute: false,
};

const activeTenant = {
  id: 'institution-123',
  name: 'Demo School',
  targetSubdomain: 'demo',
  status: 'approved',
};

async function run() {
  const activeRepository = new FakeTenantRegistryRepository(activeTenant);
  const activeService = TenantResolutionService.forRepository(activeRepository as any);
  const resolved = await activeService.resolveTenantContext(baseContext);

  equal(resolved.institutionId, 'institution-123');
  equal(resolved.schoolSlug, 'demo');
  equal(resolved.resolvedInstitution?.id, 'institution-123');
  equal(resolved.resolvedInstitution?.schoolSlug, 'demo');
  equal(resolved.resolvedInstitution?.status, 'approved');
  equal(activeRepository.lookups.length, 1);
  equal(activeRepository.lookups[0].schoolSlug, 'demo');
  equal(activeRepository.lookups[0].institutionId, undefined);

  const idRepository = new FakeTenantRegistryRepository(activeTenant);
  await TenantResolutionService.forRepository(idRepository as any).resolveTenantContext({
    institutionId: 'institution-123',
    source: 'mobile-header',
    isPlatformRoute: false,
  });
  equal(idRepository.lookups[0].institutionId, 'institution-123');

  await rejects(
    () => TenantResolutionService.forRepository(new FakeTenantRegistryRepository(null) as any).resolveTenantContext({
      ...baseContext,
      institutionId: 'other-institution',
    }),
    BadRequestException,
  );

  await rejects(
    () => TenantResolutionService.forRepository(new FakeTenantRegistryRepository(null) as any).resolveTenantContext(baseContext),
    NotFoundException,
  );

  await rejects(
    () => TenantResolutionService.forRepository(new FakeTenantRegistryRepository({ ...activeTenant, status: 'suspended' }) as any).resolveTenantContext(baseContext),
    BadRequestException,
  );

  await rejects(
    () => TenantResolutionService.forRepository(new FakeTenantRegistryRepository(null, new Error('database unavailable')) as any).resolveTenantContext(baseContext),
    ServiceUnavailableException,
  );

  const platformContext: TenantContext = {
    source: 'platform',
    isPlatformRoute: true,
  };
  const platformRepository = new FakeTenantRegistryRepository(activeTenant);
  const platformResolved = await TenantResolutionService.forRepository(platformRepository as any).resolveTenantContext(platformContext);

  equal(platformResolved, platformContext);
  equal(platformRepository.lookups.length, 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
