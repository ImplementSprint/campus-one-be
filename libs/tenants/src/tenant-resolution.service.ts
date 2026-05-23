import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { TenantRegistryRepository, type TenantProfileRecord } from './tenant-registry.repository';
import type { TenantContext } from './tenant-context';

const ACTIVE_TENANT_STATUSES = new Set(['approved', 'active']);

export function mapTenantProfileToResolvedInstitution(row: TenantProfileRecord): NonNullable<TenantContext['resolvedInstitution']> {
  return {
    id: row.id,
    schoolSlug: row.targetSubdomain,
    status: row.status ?? 'unknown',
    name: row.name ?? undefined,
  };
}

@Injectable()
export class TenantResolutionService {
  constructor(private readonly tenantRegistryRepository: TenantRegistryRepository) {
  }

  static forRepository(repository: Pick<TenantRegistryRepository, 'findInstitutionForTenant'>): TenantResolutionService {
    return new TenantResolutionService(repository as TenantRegistryRepository);
  }

  async resolveTenantContext(context: TenantContext): Promise<TenantContext> {
    if (context.isPlatformRoute || (!context.schoolSlug && !context.institutionId)) {
      return context;
    }

    let data: TenantProfileRecord | null;
    try {
      data = await this.tenantRegistryRepository.findInstitutionForTenant({
        schoolSlug: context.schoolSlug,
        institutionId: context.institutionId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      throw new ServiceUnavailableException(`Tenant lookup failed: ${message}`);
    }

    if (!data) {
      if (context.schoolSlug && context.institutionId) {
        throw new BadRequestException('Tenant slug and institution id do not match');
      }
      throw new NotFoundException('Tenant not found');
    }

    const status = data.status ?? 'unknown';
    if (!ACTIVE_TENANT_STATUSES.has(status)) {
      throw new BadRequestException(`Tenant is not active: ${status}`);
    }

    const resolvedInstitution = mapTenantProfileToResolvedInstitution(data);

    return {
      ...context,
      institutionId: data.id,
      schoolSlug: data.targetSubdomain,
      resolvedInstitution,
      isPlatformRoute: false,
    };
  }
}
