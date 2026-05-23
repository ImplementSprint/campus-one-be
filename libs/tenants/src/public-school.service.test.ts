import { deepEqual, equal, rejects } from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { PublicSchoolService, mapInstitutionProfileToPublicSchool } from './public-school.service';

const publicSchool = mapInstitutionProfileToPublicSchool({
  id: 'institution-123',
  name: 'San Beda University',
  targetSubdomain: 'san-beda',
  schoolType: 'University',
  status: 'approved',
});

deepEqual(publicSchool, {
  schoolId: 'institution-123',
  schoolSlug: 'san-beda',
  displayName: 'San Beda University',
  schoolType: 'University',
  status: 'approved',
});

class FakeTenantRegistryRepository {
  searches: Array<string | undefined> = [];
  slugLookups: string[] = [];

  constructor(private readonly school: any | null) {}

  async searchApprovedInstitutions(search?: string) {
    this.searches.push(search);
    return this.school ? [this.school] : [];
  }

  async findApprovedInstitutionBySlug(slug: string) {
    this.slugLookups.push(slug);
    return this.school;
  }
}

async function run() {
  const repository = new FakeTenantRegistryRepository({
    id: 'institution-123',
    name: 'San Beda University',
    targetSubdomain: 'san-beda',
    schoolType: 'University',
    status: 'approved',
  });
  const service = new PublicSchoolService(repository as any);

  const searchResult = await service.searchSchools(' beda ');
  deepEqual(searchResult, [publicSchool]);
  equal(repository.searches[0], ' beda ');

  const slugResult = await service.getSchoolBySlug(' SAN-BEDA ');
  deepEqual(slugResult, publicSchool);
  equal(repository.slugLookups[0], 'san-beda');

  await rejects(
    () => new PublicSchoolService(new FakeTenantRegistryRepository(null) as any).getSchoolBySlug('missing'),
    NotFoundException,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
