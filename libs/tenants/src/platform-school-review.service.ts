import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PlatformSchoolReviewRecord,
  SchoolReviewAction,
  TenantRegistryRepository,
} from './tenant-registry.repository';

export type PlatformSchoolReviewView = {
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
  approvedAt?: string | null;
  approvedBy?: string | null;
  suspendedAt?: string | null;
  suspendedBy?: string | null;
  reactivatedAt?: string | null;
  reactivatedBy?: string | null;
  ownerActivationStatus: string;
  createdAt: string;
  updatedAt: string;
};

function toIso(value?: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function mapPlatformSchoolReviewRecord(row: PlatformSchoolReviewRecord): PlatformSchoolReviewView {
  return {
    id: row.id,
    name: row.name,
    representative: row.representative,
    email: row.email,
    contactNumber: row.contactNumber,
    schoolType: row.schoolType,
    targetSubdomain: row.targetSubdomain,
    status: row.status,
    setupProgress: row.setupProgress,
    rejectionReason: row.rejectionReason,
    approvedAt: toIso(row.approvedAt),
    approvedBy: row.approvedBy,
    suspendedAt: toIso(row.suspendedAt),
    suspendedBy: row.suspendedBy,
    reactivatedAt: toIso(row.reactivatedAt),
    reactivatedBy: row.reactivatedBy,
    ownerActivationStatus: row.ownerInvitations?.[0]?.status ?? 'not_invited',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class PlatformSchoolReviewService {
  constructor(private readonly tenantRegistryRepository: TenantRegistryRepository) {}

  async listSchools(status?: string) {
    const schools = await this.tenantRegistryRepository.listPlatformSchools(status);
    return { schools: schools.map(mapPlatformSchoolReviewRecord) };
  }

  async getSchool(id: string): Promise<PlatformSchoolReviewView> {
    const school = await this.tenantRegistryRepository.getPlatformSchoolById(id);
    if (!school) throw new NotFoundException('School registration not found.');
    return mapPlatformSchoolReviewRecord(school);
  }

  async approveSchool(id: string, actorUserId: string) {
    await this.assertTransitionAllowed(id, 'approve');
    const school = await this.tenantRegistryRepository.transitionPlatformSchool({
      schoolId: id,
      action: 'approve',
      actorUserId,
    });

    return {
      message: 'School approved.',
      school: mapPlatformSchoolReviewRecord(school),
    };
  }

  async rejectSchool(id: string, actorUserId: string, reason: string) {
    const cleanReason = reason?.trim();
    if (!cleanReason) throw new BadRequestException('Rejection reason is required.');

    await this.assertTransitionAllowed(id, 'reject');
    const school = await this.tenantRegistryRepository.transitionPlatformSchool({
      schoolId: id,
      action: 'reject',
      actorUserId,
      reason: cleanReason,
    });

    return {
      message: 'School rejected.',
      school: mapPlatformSchoolReviewRecord(school),
    };
  }

  async suspendSchool(id: string, actorUserId: string, reason?: string) {
    await this.assertTransitionAllowed(id, 'suspend');
    const school = await this.tenantRegistryRepository.transitionPlatformSchool({
      schoolId: id,
      action: 'suspend',
      actorUserId,
      reason: reason?.trim() || undefined,
    });

    return {
      message: 'School suspended.',
      school: mapPlatformSchoolReviewRecord(school),
    };
  }

  async reactivateSchool(id: string, actorUserId: string, reason?: string) {
    await this.assertTransitionAllowed(id, 'reactivate');
    const school = await this.tenantRegistryRepository.transitionPlatformSchool({
      schoolId: id,
      action: 'reactivate',
      actorUserId,
      reason: reason?.trim() || undefined,
    });

    return {
      message: 'School reactivated.',
      school: mapPlatformSchoolReviewRecord(school),
    };
  }

  private async assertTransitionAllowed(id: string, action: SchoolReviewAction) {
    const school = await this.tenantRegistryRepository.getPlatformSchoolById(id);
    if (!school) throw new NotFoundException('School registration not found.');

    const status = school.status;
    const allowed = {
      approve: ['pending_review', 'rejected'],
      reject: ['pending_review'],
      suspend: ['approved'],
      reactivate: ['suspended'],
    } satisfies Record<SchoolReviewAction, string[]>;

    if (!allowed[action].includes(status)) {
      throw new BadRequestException(`Cannot ${action} a school with status ${status}.`);
    }
  }
}
