import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { RESERVED_TENANT_SLUGS, normalizeSchoolSlug } from './tenant-resolution.middleware';
import { TenantRegistryRepository } from './tenant-registry.repository';
import { mapInstitutionProfileToPublicSchool } from './public-school.service';
import type { RegisterSchoolDto } from './school-onboarding.dto';

const OWNER_INVITATION_TTL_DAYS = 7;

function clean(value: string): string {
  return value.trim();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SchoolOnboardingService {
  constructor(private readonly tenantRegistryRepository: TenantRegistryRepository) {}

  async registerSchool(dto: RegisterSchoolDto) {
    const targetSubdomain = normalizeSchoolSlug(dto.targetSubdomain);
    if (!targetSubdomain || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(targetSubdomain)) {
      throw new BadRequestException('Target subdomain must be a valid lowercase slug.');
    }

    if (RESERVED_TENANT_SLUGS.has(targetSubdomain)) {
      throw new BadRequestException('Target subdomain is reserved.');
    }

    const duplicate = await this.tenantRegistryRepository.findInstitutionBySlug(targetSubdomain);
    if (duplicate && ['pending_review', 'approved', 'suspended'].includes(duplicate.status ?? '')) {
      throw new ConflictException('Target subdomain is already registered.');
    }

    const institutionId = randomUUID();
    const setupToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + OWNER_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.tenantRegistryRepository.createSchoolRegistration({
      institution: {
        id: institutionId,
        name: clean(dto.name),
        representative: clean(dto.representative),
        email: clean(dto.email).toLowerCase(),
        contactNumber: clean(dto.contactNumber),
        schoolType: clean(dto.schoolType),
        targetSubdomain,
      },
      invitation: {
        email: clean(dto.email).toLowerCase(),
        tokenHash: hashToken(setupToken),
        expiresAt,
      },
      audit: {
        eventType: 'platform.school.registered',
        metadata: {
          schoolName: clean(dto.name),
          representative: clean(dto.representative),
          email: clean(dto.email).toLowerCase(),
          targetSubdomain,
          schoolType: clean(dto.schoolType),
        },
      },
    });

    return {
      message: 'School registration submitted for review.',
      school: mapInstitutionProfileToPublicSchool(result.institution),
      onboarding: {
        currentStep: result.onboarding.currentStep,
        progress: result.onboarding.progress,
      },
      ownerInvitation: {
        id: result.invitation.id,
        email: result.invitation.email,
        status: result.invitation.status,
        expiresAt: result.invitation.expiresAt.toISOString(),
      },
      next: `/schools/register/submitted?school=${targetSubdomain}`,
    };
  }
}
