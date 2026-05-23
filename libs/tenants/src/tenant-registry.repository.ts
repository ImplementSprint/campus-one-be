import { Injectable } from '@nestjs/common';
import { TenantRegistryPrismaClient } from '@campus-one/database/prisma/tenant-registry-prisma.client';
import type { Prisma } from '../../../src/generated/prisma/tenant-registry/client';

export type TenantProfileRecord = {
  id: string;
  name: string | null;
  representative?: string | null;
  email?: string | null;
  contactNumber?: string | null;
  targetSubdomain: string;
  schoolType?: string | null;
  status: string | null;
};

export type PlatformSchoolReviewRecord = {
  id: string;
  name: string;
  representative: string;
  email: string;
  contactNumber: string;
  schoolType: string;
  targetSubdomain: string;
  status: string;
  setupProgress: number;
  rejectionReason?: string | null;
  approvedAt?: Date | null;
  approvedBy?: string | null;
  suspendedAt?: Date | null;
  suspendedBy?: string | null;
  reactivatedAt?: Date | null;
  reactivatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  ownerInvitations?: Array<{
    status: string;
  }>;
};

export type TenantRegistryLookup = {
  schoolSlug?: string;
  institutionId?: string;
};

export type TenantRegistryClient = {
  $transaction?<T>(handler: (client: TenantRegistryClient) => Promise<T>): Promise<T>;
  institutionProfile: {
    findFirst(args: {
      where: {
        targetSubdomain?: string;
        id?: string;
      };
      select: {
        id: true;
        name: true;
        targetSubdomain: true;
        schoolType?: true;
        status: true;
      };
    }): Promise<TenantProfileRecord | null>;
    create(args: {
      data: {
        id: string;
        name: string;
        representative: string;
        email: string;
        contactNumber: string;
        schoolType: string;
        targetSubdomain: string;
        status: string;
        setupProgress: number;
      };
      select: {
        id: true;
        name: true;
        representative: true;
        email: true;
        contactNumber: true;
        targetSubdomain: true;
        schoolType: true;
        status: true;
      };
    }): Promise<TenantProfileRecord>;
    findMany(args: {
      where: {
        status: string;
        OR?: Array<{
          name?: {
            contains: string;
            mode: 'insensitive';
          };
          targetSubdomain?: {
            contains: string;
            mode: 'insensitive';
          };
        }>;
      };
      orderBy: {
        name: 'asc';
      };
      take: number;
      select: {
        id: true;
        name: true;
        targetSubdomain: true;
        schoolType: true;
        status: true;
      };
    }): Promise<TenantProfileRecord[]>;
  };
  onboardingProgress: {
    create(args: {
      data: {
        institutionId: string;
        currentStep: string;
        progress: number;
      };
      select: {
        currentStep: true;
        progress: true;
      };
    }): Promise<{
      currentStep: string;
      progress: number;
    }>;
  };
  schoolOwnerInvitation: {
    create(args: {
      data: {
        institutionId: string;
        email: string;
        tokenHash: string;
        expiresAt: Date;
      };
      select: {
        id: true;
        email: true;
        status: true;
        expiresAt: true;
      };
    }): Promise<{
      id: string;
      email: string;
      status: string;
      expiresAt: Date;
    }>;
  };
  auditEvent: {
    create(args: {
      data: {
        institution?: {
          connect: {
            id: string;
          };
        };
        eventType: string;
        metadata: Prisma.InputJsonObject;
      };
    }): Promise<unknown>;
  };
};

export type CreateSchoolRegistrationInput = {
  institution: {
    id: string;
    name: string;
    representative: string;
    email: string;
    contactNumber: string;
    schoolType: string;
    targetSubdomain: string;
  };
  invitation: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
  };
  audit: {
    eventType: string;
    metadata: Prisma.InputJsonObject;
  };
};

export type SchoolReviewAction =
  | 'approve'
  | 'reject'
  | 'suspend'
  | 'reactivate';

export type SchoolReviewTransitionInput = {
  schoolId: string;
  action: SchoolReviewAction;
  actorUserId: string;
  reason?: string;
};

const PLATFORM_SCHOOL_SELECT = {
  id: true,
  name: true,
  representative: true,
  email: true,
  contactNumber: true,
  schoolType: true,
  targetSubdomain: true,
  status: true,
  setupProgress: true,
  rejectionReason: true,
  approvedAt: true,
  approvedBy: true,
  suspendedAt: true,
  suspendedBy: true,
  reactivatedAt: true,
  reactivatedBy: true,
  createdAt: true,
  updatedAt: true,
  ownerInvitations: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { status: true },
  },
} as const;

@Injectable()
export class TenantRegistryRepository {
  constructor(private readonly client: TenantRegistryPrismaClient) {}

  static forClient(client: TenantRegistryClient): TenantRegistryRepository {
    return new TenantRegistryRepository(client as unknown as TenantRegistryPrismaClient);
  }

  findInstitutionForTenant(
    lookup: TenantRegistryLookup,
  ): Promise<TenantProfileRecord | null> {
    return this.client.institutionProfile.findFirst({
      where: {
        ...(lookup.schoolSlug ? { targetSubdomain: lookup.schoolSlug } : {}),
        ...(lookup.institutionId ? { id: lookup.institutionId } : {}),
      },
      select: {
        id: true,
        name: true,
        targetSubdomain: true,
        status: true,
      },
    });
  }

  findInstitutionBySlug(slug: string): Promise<TenantProfileRecord | null> {
    return this.client.institutionProfile.findFirst({
      where: {
        targetSubdomain: slug,
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

  createSchoolRegistration(input: CreateSchoolRegistrationInput) {
    return this.client.$transaction(async (client) => {
      const institution = await client.institutionProfile.create({
        data: {
          ...input.institution,
          status: 'pending_review',
          setupProgress: 10,
        },
        select: {
          id: true,
          name: true,
          representative: true,
          email: true,
          contactNumber: true,
          targetSubdomain: true,
          schoolType: true,
          status: true,
        },
      });

      const onboarding = await client.onboardingProgress.create({
        data: {
          institutionId: institution.id,
          currentStep: 'registration_submitted',
          progress: 10,
        },
        select: {
          currentStep: true,
          progress: true,
        },
      });

      const invitation = await client.schoolOwnerInvitation.create({
        data: {
          institutionId: institution.id,
          ...input.invitation,
        },
        select: {
          id: true,
          email: true,
          status: true,
          expiresAt: true,
        },
      });

      await client.auditEvent.create({
        data: {
          institution: {
            connect: {
              id: institution.id,
            },
          },
          ...input.audit,
        },
      });

      return { institution, onboarding, invitation };
    });
  }

  searchApprovedInstitutions(search?: string): Promise<TenantProfileRecord[]> {
    const term = search?.trim().replace(/[%_]/g, '');
    const where = {
      status: 'approved',
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { targetSubdomain: { contains: term, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    return this.client.institutionProfile.findMany({
      where,
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
  }

  findApprovedInstitutionBySlug(slug: string): Promise<TenantProfileRecord | null> {
    return this.client.institutionProfile.findFirst({
      where: {
        targetSubdomain: slug,
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

  listPlatformSchools(status?: string): Promise<PlatformSchoolReviewRecord[]> {
    const normalizedStatus = status?.trim();
    return (this.client as any).institutionProfile.findMany({
      where: normalizedStatus ? { status: normalizedStatus } : {},
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      select: PLATFORM_SCHOOL_SELECT,
    });
  }

  getPlatformSchoolById(id: string): Promise<PlatformSchoolReviewRecord | null> {
    return (this.client as any).institutionProfile.findUnique({
      where: { id },
      select: PLATFORM_SCHOOL_SELECT,
    });
  }

  transitionPlatformSchool(input: SchoolReviewTransitionInput): Promise<PlatformSchoolReviewRecord> {
    const now = new Date();
    const updateData = this.getReviewUpdateData(input, now);

    return this.client.$transaction(async (client) => {
      const school = await (client as any).institutionProfile.update({
        where: { id: input.schoolId },
        data: updateData,
        select: PLATFORM_SCHOOL_SELECT,
      });

      await (client as any).auditEvent.create({
        data: {
          institution: {
            connect: {
              id: school.id,
            },
          },
          actorUserId: input.actorUserId,
          eventType: getSchoolReviewAuditEvent(input.action),
          metadata: {
            status: school.status,
            ...(input.reason ? { reason: input.reason } : {}),
            targetSubdomain: school.targetSubdomain,
          },
        },
      });

      return school;
    });
  }

  private getReviewUpdateData(input: SchoolReviewTransitionInput, now: Date) {
    switch (input.action) {
      case 'approve':
        return {
          status: 'approved',
          setupProgress: 30,
          rejectionReason: null,
          approvedAt: now,
          approvedBy: input.actorUserId,
        };
      case 'reject':
        return {
          status: 'rejected',
          rejectionReason: input.reason,
        };
      case 'suspend':
        return {
          status: 'suspended',
          suspendedAt: now,
          suspendedBy: input.actorUserId,
        };
      case 'reactivate':
        return {
          status: 'approved',
          suspendedAt: null,
          suspendedBy: null,
          reactivatedAt: now,
          reactivatedBy: input.actorUserId,
        };
    }
  }
}

function getSchoolReviewAuditEvent(action: SchoolReviewAction): string {
  switch (action) {
    case 'approve':
      return 'platform.school.approved';
    case 'reject':
      return 'platform.school.rejected';
    case 'suspend':
      return 'platform.school.suspended';
    case 'reactivate':
      return 'platform.school.reactivated';
  }
}
