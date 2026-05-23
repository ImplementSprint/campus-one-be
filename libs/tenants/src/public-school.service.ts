import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantProfileRecord, TenantRegistryRepository } from './tenant-registry.repository';
import { normalizeSchoolSlug } from './tenant-resolution.middleware';

export type PublicSchool = {
  schoolId: string;
  schoolSlug: string;
  displayName: string;
  schoolType?: string | null;
  status?: string | null;
};

export function mapInstitutionProfileToPublicSchool(row: TenantProfileRecord): PublicSchool {
  return {
    schoolId: row.id,
    schoolSlug: row.targetSubdomain,
    displayName: row.name ?? '',
    schoolType: row.schoolType,
    status: row.status,
  };
}

@Injectable()
export class PublicSchoolService {
  constructor(private readonly tenantRegistryRepository: TenantRegistryRepository) {}

  async searchSchools(search?: string): Promise<PublicSchool[]> {
    const data = await this.tenantRegistryRepository.searchApprovedInstitutions(search);

    return data.map(mapInstitutionProfileToPublicSchool);
  }

  async getSchoolBySlug(slug: string): Promise<PublicSchool> {
    const normalizedSlug = normalizeSchoolSlug(slug);
    if (!normalizedSlug) throw new NotFoundException('School not found');

    const data = await this.tenantRegistryRepository.findApprovedInstitutionBySlug(normalizedSlug);

    if (!data) throw new NotFoundException('School not found');

    return mapInstitutionProfileToPublicSchool(data);
  }
}
