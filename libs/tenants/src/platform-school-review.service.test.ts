import * as assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PlatformSchoolReviewService,
  mapPlatformSchoolReviewRecord,
} from './platform-school-review.service';

const baseDate = new Date('2026-05-23T00:00:00.000Z');

function school(overrides: Record<string, unknown> = {}) {
  return {
    id: 'institution-123',
    name: 'Demo University',
    representative: 'Jane Registrar',
    email: 'owner@demo.edu',
    contactNumber: '+63 912 345 6789',
    schoolType: 'University',
    targetSubdomain: 'demo',
    status: 'pending_review',
    setupProgress: 10,
    rejectionReason: null,
    approvedAt: null,
    approvedBy: null,
    suspendedAt: null,
    suspendedBy: null,
    reactivatedAt: null,
    reactivatedBy: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ownerInvitations: [{ status: 'pending' }],
    ...overrides,
  } as any;
}

class FakeTenantRegistryRepository {
  record: any | null = school();
  transitions: any[] = [];

  async listPlatformSchools(status?: string) {
    return status && this.record?.status !== status ? [] : this.record ? [this.record] : [];
  }

  async getPlatformSchoolById() {
    return this.record;
  }

  async transitionPlatformSchool(input: any) {
    this.transitions.push(input);
    this.record = {
      ...this.record,
      status: input.action === 'approve' || input.action === 'reactivate'
        ? 'approved'
        : input.action === 'reject'
          ? 'rejected'
          : 'suspended',
      rejectionReason: input.action === 'reject' ? input.reason : this.record.rejectionReason,
      approvedAt: input.action === 'approve' ? baseDate : this.record.approvedAt,
      approvedBy: input.action === 'approve' ? input.actorUserId : this.record.approvedBy,
      suspendedAt: input.action === 'suspend' ? baseDate : this.record.suspendedAt,
      suspendedBy: input.action === 'suspend' ? input.actorUserId : this.record.suspendedBy,
      reactivatedAt: input.action === 'reactivate' ? baseDate : this.record.reactivatedAt,
      reactivatedBy: input.action === 'reactivate' ? input.actorUserId : this.record.reactivatedBy,
      updatedAt: baseDate,
    };
    return this.record;
  }
}

async function run() {
  const mapped = mapPlatformSchoolReviewRecord(school({ approvedAt: baseDate, approvedBy: 'admin-1' }));
  assert.equal(mapped.ownerActivationStatus, 'pending');
  assert.equal(mapped.approvedAt, '2026-05-23T00:00:00.000Z');
  assert.equal(mapped.approvedBy, 'admin-1');

  const repository = new FakeTenantRegistryRepository();
  const service = new PlatformSchoolReviewService(repository as any);

  const list = await service.listSchools('pending_review');
  assert.equal(list.schools.length, 1);

  const detail = await service.getSchool('institution-123');
  assert.equal(detail.id, 'institution-123');

  const approved = await service.approveSchool('institution-123', 'admin-1');
  assert.equal(approved.school.status, 'approved');
  assert.equal(repository.transitions[0].action, 'approve');

  await assert.rejects(
    () => service.rejectSchool('institution-123', 'admin-1', 'Incomplete documents'),
    BadRequestException,
  );

  const suspended = await service.suspendSchool('institution-123', 'admin-1', 'Compliance hold');
  assert.equal(suspended.school.status, 'suspended');
  assert.equal(repository.transitions[1].reason, 'Compliance hold');

  const reactivated = await service.reactivateSchool('institution-123', 'admin-1', 'Resolved');
  assert.equal(reactivated.school.status, 'approved');

  const missingService = new PlatformSchoolReviewService({ getPlatformSchoolById: async () => null } as any);
  await assert.rejects(() => missingService.getSchool('missing'), NotFoundException);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
