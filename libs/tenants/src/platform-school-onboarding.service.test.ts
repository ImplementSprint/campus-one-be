import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { deepEqual, rejects, strictEqual } from 'node:assert/strict';
import {
  PostgresPlatformSchoolRegistrationRepository,
  PlatformSchoolOnboardingService,
  type PlatformSchoolOnboardingEmailNotifier,
  type PlatformSchoolRegistrationRepository,
  type SchoolOnboardingProgressRecord,
  type SchoolOwnerAccountRecord,
  type SchoolOwnerInvitationRecord,
  type SchoolRegistrationRecord,
  type SchoolRegistrationAuditEvent,
  type SchoolRegistrationBundle,
} from './platform-school-onboarding.service';
import type {
  SchoolApproveRequest,
  SchoolOnboardingStatus,
  SchoolReviewActionRequest,
  SchoolReviewRecord,
} from '@campus-one/contracts';

class MemoryRegistrationRepository implements PlatformSchoolRegistrationRepository {
  readonly records = new Map<string, SchoolRegistrationRecord>();
  readonly recordsById = new Map<string, SchoolRegistrationRecord>();
  readonly onboardingProgress = new Map<string, SchoolOnboardingProgressRecord>();
  readonly ownerInvitations = new Map<string, SchoolOwnerInvitationRecord>();
  readonly ownerAccounts = new Map<string, SchoolOwnerAccountRecord>();
  readonly auditEvents: SchoolRegistrationAuditEvent[] = [];

  async findBySlug(slug: string): Promise<SchoolRegistrationRecord | null> {
    return this.records.get(slug) ?? null;
  }

  async createRegistrationBundle(bundle: SchoolRegistrationBundle): Promise<SchoolRegistrationRecord> {
    this.records.set(bundle.school.targetSubdomain, bundle.school);
    this.recordsById.set(bundle.school.id, bundle.school);
    this.onboardingProgress.set(bundle.onboardingProgress.institutionId, bundle.onboardingProgress);
    this.ownerInvitations.set(bundle.ownerInvitation.institutionId, bundle.ownerInvitation);
    this.auditEvents.push(bundle.auditEvent);
    return bundle.school;
  }

  async listReviewRecords(): Promise<SchoolReviewRecord[]> {
    return Array.from(this.recordsById.values()).map((record) => this.toReviewRecord(record));
  }

  async findReviewRecordById(id: string): Promise<SchoolReviewRecord | null> {
    const record = this.recordsById.get(id);
    return record ? this.toReviewRecord(record) : null;
  }

  async approveSchoolReview(
    id: string,
    input: SchoolApproveRequest & { approvedAt: string },
  ): Promise<SchoolReviewRecord | null> {
    return this.updateStatus(id, 'approved', 'platform.school.approved', input.approverEmail, {
      approvedAt: input.approvedAt,
      approvedBy: input.approverId,
      metadata: { approverId: input.approverId },
      completedSteps: ['registration_submitted', 'platform_review_approved'],
    });
  }

  async rejectSchoolReview(
    id: string,
    input: Required<Pick<SchoolReviewActionRequest, 'reason'>> & { actorEmail?: string },
  ): Promise<SchoolReviewRecord | null> {
    return this.updateStatus(id, 'rejected', 'platform.school.rejected', input.actorEmail, {
      rejectionReason: input.reason,
      metadata: { reason: input.reason },
    });
  }

  async suspendSchool(id: string, input: SchoolReviewActionRequest): Promise<SchoolReviewRecord | null> {
    return this.updateStatus(id, 'suspended', 'platform.school.suspended', input.actorEmail, {
      metadata: input.reason ? { reason: input.reason } : {},
      completedSteps: ['registration_submitted', 'platform_review_approved'],
    });
  }

  async reactivateSchool(id: string, input: SchoolReviewActionRequest): Promise<SchoolReviewRecord | null> {
    return this.updateStatus(id, 'approved', 'platform.school.reactivated', input.actorEmail, {
      rejectionReason: null,
      metadata: input.reason ? { reason: input.reason } : {},
      completedSteps: ['registration_submitted', 'platform_review_approved'],
    });
  }

  async findOwnerInvitationByTokenHash(tokenHash: string): Promise<SchoolOwnerInvitationRecord | null> {
    return Array.from(this.ownerInvitations.values()).find((invitation) => invitation.tokenHash === tokenHash) ?? null;
  }

  async acceptOwnerInvitation(input: {
    institutionId: string;
    tokenHash: string;
    acceptedAt: string;
    ownerAccount: SchoolOwnerAccountRecord;
  }): Promise<SchoolReviewRecord | null> {
    const invitation = this.ownerInvitations.get(input.institutionId);
    if (!invitation || invitation.tokenHash !== input.tokenHash || invitation.status !== 'pending') return null;

    invitation.status = 'accepted' as any;
    invitation.acceptedAt = input.acceptedAt;
    this.ownerAccounts.set(input.ownerAccount.email, input.ownerAccount);

    const progress = this.onboardingProgress.get(input.institutionId);
    if (progress) {
      progress.currentStep = 'owner_account_created';
      progress.completedSteps = [
        ...new Set([...progress.completedSteps, 'owner_invitation_accepted', 'owner_account_created']),
      ];
    }

    this.auditEvents.push({
      institutionId: input.institutionId,
      action: 'platform.school.owner_account_created' as any,
      actorEmail: invitation.email,
      metadata: { next: 'tenant_portal_login' },
      createdAt: input.acceptedAt,
    });

    const record = this.recordsById.get(input.institutionId);
    return record ? this.toReviewRecord(record) : null;
  }

  private updateStatus(
    id: string,
    status: SchoolOnboardingStatus,
    action: SchoolRegistrationAuditEvent['action'],
    actorEmail: string | undefined,
    options: {
      approvedAt?: string;
      approvedBy?: string;
      rejectionReason?: string | null;
      metadata?: Record<string, unknown>;
      completedSteps?: string[];
    },
  ): SchoolReviewRecord | null {
    const record = this.recordsById.get(id);
    if (!record) return null;

    record.status = status;
    record.approvedAt = options.approvedAt ?? record.approvedAt ?? null;
    record.approvedBy = options.approvedBy ?? record.approvedBy ?? null;
    record.rejectionReason = options.rejectionReason ?? record.rejectionReason ?? null;

    const progress = this.onboardingProgress.get(id);
    if (progress) {
      progress.status = status;
      progress.currentStep = status === 'suspended' ? 'suspended' : status === 'rejected' ? 'platform_review' : 'owner_activation';
      progress.completedSteps = options.completedSteps ?? progress.completedSteps;
    }

    this.auditEvents.push({
      institutionId: id,
      action,
      actorEmail,
      metadata: options.metadata ?? {},
      createdAt: new Date().toISOString(),
    });

    return this.toReviewRecord(record);
  }

  private toReviewRecord(record: SchoolRegistrationRecord): SchoolReviewRecord {
    return {
      school: {
        schoolId: record.id,
        schoolSlug: record.targetSubdomain,
        displayName: record.name,
        schoolType: record.schoolType,
        status: record.status,
      },
      representative: record.representative,
      contactEmail: record.contactEmail,
      contactNumber: record.contactNumber,
      schoolType: record.schoolType,
      ownerInvitationStatus: this.ownerInvitations.get(record.id)?.status,
      onboardingStatus: this.onboardingProgress.get(record.id)?.status ?? record.status,
      approvedAt: record.approvedAt ?? null,
      approvedBy: record.approvedBy ?? null,
      rejectionReason: record.rejectionReason ?? null,
      auditTrail: this.auditEvents
        .filter((event) => event.institutionId === record.id)
        .map(({ action, actorEmail, metadata, createdAt }) => ({ action, actorEmail, metadata, createdAt })),
    };
  }
}

class MemoryConfirmationEmailNotifier implements PlatformSchoolOnboardingEmailNotifier {
  readonly confirmations: Parameters<PlatformSchoolOnboardingEmailNotifier['sendSchoolRegistrationConfirmation']>[0][] = [];

  async sendSchoolRegistrationConfirmation(
    payload: Parameters<PlatformSchoolOnboardingEmailNotifier['sendSchoolRegistrationConfirmation']>[0],
  ): Promise<void> {
    this.confirmations.push(payload);
  }
}

class SchemaCheckingClient {
  readonly queries: Array<{ text: string; values?: unknown[] }> = [];
  private readonly reviewRows = new Map<string, any>();

  constructor(private readonly databaseName = 'tenant_registry') {}

  async query(text: string, values?: unknown[]) {
    this.queries.push({ text, values });
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized === 'begin' || normalized === 'commit' || normalized === 'rollback') return { rows: [] };
    if (normalized.includes('insert into onboarding_progress') && normalized.includes('completed_steps')) {
      throw new Error('onboarding_progress.completed_steps does not exist');
    }
    if (normalized.includes('insert into onboarding_progress') && normalized.includes('status')) {
      throw new Error('onboarding_progress.status does not exist');
    }
    if (normalized.includes('update onboarding_progress') && normalized.includes('completed_steps')) {
      throw new Error('onboarding_progress.completed_steps does not exist');
    }
    if (normalized.includes('update onboarding_progress') && normalized.includes('status')) {
      throw new Error('onboarding_progress.status does not exist');
    }
    if (normalized.includes('insert into school_owner_invitations') && !normalized.includes('expires_at')) {
      throw new Error('school_owner_invitations.expires_at is required');
    }
    if (normalized.includes('school_owner_invitations') && normalized.includes('accepted_at')) {
      throw new Error('school_owner_invitations.accepted_at does not exist');
    }
    if (normalized.includes('insert into audit_events') && normalized.includes('action')) {
      throw new Error('audit_events.action does not exist');
    }
    if (normalized.includes('insert into audit_events') && normalized.includes('actor_email')) {
      throw new Error('audit_events.actor_email does not exist');
    }
    if (normalized.includes('json_build_object') && normalized.includes("'action', ae.action")) {
      throw new Error('audit_events.action does not exist');
    }
    if (normalized.includes('json_build_object') && normalized.includes("'actoremail', ae.actor_email")) {
      throw new Error('audit_events.actor_email does not exist');
    }
    if (normalized.includes('group by') && normalized.includes('op.status')) {
      throw new Error('onboarding_progress.status does not exist');
    }
    if (this.databaseName === 'tenant_registry' && normalized.includes('insert into portal_accounts')) {
      throw new Error('portal_accounts belongs to identity_access');
    }
    if (this.databaseName === 'tenant_registry' && normalized.includes('insert into school_owner_accounts')) {
      throw new Error('school_owner_accounts belongs to identity_access');
    }
    if (this.databaseName === 'identity_access' && normalized.includes('insert into audit_events')) {
      throw new Error('audit_events belongs to tenant_registry');
    }

    if (normalized.includes('insert into institution_profiles')) {
      const row = {
        id: values?.[0],
        name: values?.[1],
        representative: values?.[2],
        contactEmail: values?.[3],
        contactNumber: values?.[4],
        schoolType: values?.[5],
        targetSubdomain: values?.[6],
        status: values?.[7],
        ownerInvitationStatus: 'pending',
        onboardingStatus: values?.[7],
        approvedAt: null,
        approvedBy: null,
        rejectionReason: null,
        auditTrail: [],
      };
      this.reviewRows.set(String(row.id), row);
      return { rows: [row] };
    }

    if (normalized.includes('select id from institution_profiles')) {
      return { rows: this.reviewRows.has(String(values?.[0])) ? [{ id: values?.[0] }] : [] };
    }

    if (normalized.includes('update institution_profiles')) {
      const row = this.reviewRows.get(String(values?.[0]));
      if (row) {
        row.status = values?.[1];
        row.approvedAt = values?.[2] ?? row.approvedAt;
        row.approvedBy = values?.[3] ?? row.approvedBy;
        row.rejectionReason = values?.[4] ?? row.rejectionReason;
      }
      return { rows: [] };
    }

    if (normalized.includes('update school_owner_invitations')) {
      const row = this.reviewRows.get(String(values?.[0]));
      if (row) row.ownerInvitationStatus = 'accepted';
      return { rows: [{ institutionId: values?.[0], email: 'owner@schema.test' }] };
    }

    if (normalized.includes('update onboarding_progress')) {
      return { rows: [] };
    }

    if (normalized.includes('from institution_profiles p')) {
      const row = this.reviewRows.get(String(values?.[0]));
      return { rows: row ? [{ ...row, auditTrail: [] }] : [] };
    }

    return { rows: [] };
  }

  release() {}
}

class SchemaCheckingPool extends SchemaCheckingClient {
  async connect() {
    return this;
  }
}

async function main() {
  const repository = new MemoryRegistrationRepository();
  const service = new PlatformSchoolOnboardingService(repository);

  const availabilityRepository = new MemoryRegistrationRepository();
  const availabilityService = new PlatformSchoolOnboardingService(availabilityRepository);
  availabilityRepository.records.set('active-school', {
    id: 'active-school-id',
    name: 'Active School',
    representative: 'Ada Santos',
    contactEmail: 'owner@active.test',
    contactNumber: '+63 900 000 0000',
    schoolType: 'University',
    targetSubdomain: 'active-school',
    status: 'approved',
  });
  availabilityRepository.records.set('pending-school', {
    id: 'pending-school-id',
    name: 'Pending School',
    representative: 'Ada Santos',
    contactEmail: 'owner@pending.test',
    contactNumber: '+63 900 000 0000',
    schoolType: 'University',
    targetSubdomain: 'pending-school',
    status: 'pending_review',
  });
  availabilityRepository.records.set('suspended-school', {
    id: 'suspended-school-id',
    name: 'Suspended School',
    representative: 'Ada Santos',
    contactEmail: 'owner@suspended.test',
    contactNumber: '+63 900 000 0000',
    schoolType: 'University',
    targetSubdomain: 'suspended-school',
    status: 'suspended',
  });

  deepEqual(await (availabilityService as any).checkSlugAvailability(' API '), {
    slug: 'api',
    available: false,
    reason: 'reserved',
  });
  deepEqual(await (availabilityService as any).checkSlugAvailability(' !!! '), {
    slug: '',
    available: false,
    reason: 'invalid',
  });
  deepEqual(await (availabilityService as any).checkSlugAvailability(' Active School '), {
    slug: 'active-school',
    available: false,
    reason: 'existing',
  });
  deepEqual(await (availabilityService as any).checkSlugAvailability(' Pending School '), {
    slug: 'pending-school',
    available: false,
    reason: 'existing',
  });
  deepEqual(await (availabilityService as any).checkSlugAvailability(' Suspended School '), {
    slug: 'suspended-school',
    available: false,
    reason: 'existing',
  });
  deepEqual(await (availabilityService as any).checkSlugAvailability(' New Campus '), {
    slug: 'new-campus',
    available: true,
  });

  const response = await service.registerSchool({
    name: 'Demo University',
    representative: 'Ada Santos',
    email: ' Owner@Demo.test ',
    contactNumber: '+63 900 000 0000',
    schoolType: 'University',
    targetSubdomain: ' Demo-School ',
  });

  strictEqual(response.school.schoolSlug, 'demo-school');
  strictEqual(response.school.status, 'pending_review');
  strictEqual(response.next, 'platform_review');
  strictEqual(response.ownerInvitationStatus, 'pending');
  strictEqual(response.onboardingStatus, 'pending_review');

  const stored = await repository.findBySlug('demo-school');
  deepEqual(stored?.contactEmail, 'owner@demo.test');
  deepEqual(repository.onboardingProgress.get(response.school.schoolId), {
    institutionId: response.school.schoolId,
    currentStep: 'owner_activation',
    completedSteps: ['registration_submitted'],
    status: 'pending_review',
  });
  strictEqual(repository.ownerInvitations.get(response.school.schoolId)?.email, 'owner@demo.test');
  strictEqual(repository.ownerInvitations.get(response.school.schoolId)?.status, 'pending');
  strictEqual(repository.ownerInvitations.get(response.school.schoolId)?.tokenHash.length, 64);
  deepEqual(repository.auditEvents[0], {
    institutionId: response.school.schoolId,
    action: 'platform.school.registered',
    actorEmail: 'owner@demo.test',
    metadata: {
      schoolSlug: 'demo-school',
      schoolType: 'University',
    },
  });

  const emailRepository = new MemoryRegistrationRepository();
  const emailNotifier = new MemoryConfirmationEmailNotifier();
  const emailService = new PlatformSchoolOnboardingService(emailRepository, emailNotifier);
  const emailResponse = await emailService.registerSchool({
    name: 'Email University',
    representative: 'Mina Cruz',
    email: ' Owner@Email.test ',
    contactNumber: '+63 900 111 0000',
    schoolType: 'University',
    targetSubdomain: 'email-u',
  });
  deepEqual(emailNotifier.confirmations, [
    {
      to: 'owner@email.test',
      schoolId: emailResponse.school.schoolId,
      schoolSlug: 'email-u',
      schoolName: 'Email University',
      nextStep: 'platform_review',
    },
  ]);

  await rejects(
    () =>
      service.registerSchool({
        name: 'API School',
        representative: 'Ada Santos',
        email: 'owner@api.test',
        contactNumber: '+63 900 000 0000',
        schoolType: 'University',
        targetSubdomain: 'api',
      }),
    BadRequestException,
  );

  await rejects(
    () =>
      service.registerSchool({
        name: 'Duplicate School',
        representative: 'Ada Santos',
        email: 'owner2@demo.test',
        contactNumber: '+63 900 000 0000',
        schoolType: 'University',
        targetSubdomain: 'demo-school',
      }),
    ConflictException,
  );

  const reviewRepository = new MemoryRegistrationRepository();
  const reviewService = new PlatformSchoolOnboardingService(reviewRepository) as any;
  const reviewEvents: unknown[] = [];
  reviewService.eventPublisher = {
    publish(input: unknown) {
      reviewEvents.push(input);
      return Promise.resolve({ envelope: input, published: true });
    },
  };
  const reviewRegistration = await reviewService.registerSchool({
    name: 'Review University',
    representative: 'Grace Tan',
    email: 'owner@review.test',
    contactNumber: '+63 900 111 2222',
    schoolType: 'University',
    targetSubdomain: 'review-u',
  });

  const reviewList = await reviewService.listSchools();
  strictEqual(reviewList.schools.length, 1);
  strictEqual(reviewList.schools[0].school.schoolId, reviewRegistration.school.schoolId);
  strictEqual(reviewList.schools[0].ownerInvitationStatus, 'pending');
  strictEqual(reviewList.schools[0].onboardingStatus, 'pending_review');

  const fetched = await reviewService.getSchool(reviewRegistration.school.schoolId);
  strictEqual(fetched.school.schoolSlug, 'review-u');
  strictEqual(fetched.auditTrail[0].action, 'platform.school.registered');

  const approved = await reviewService.approveSchool(reviewRegistration.school.schoolId, {
    approverId: 'admin-1',
    approverEmail: 'admin@campus.test',
  });
  strictEqual(approved.school.status, 'approved');
  strictEqual(approved.onboardingStatus, 'approved');
  strictEqual(approved.ownerInvitationStatus, 'pending');
  strictEqual(approved.approvedBy, 'admin-1');
  strictEqual(typeof approved.approvedAt, 'string');
  strictEqual(reviewRepository.auditEvents.at(-1)?.action, 'platform.school.approved');
  deepEqual(reviewEvents.at(-1), {
    eventType: 'school.review.approved',
    tenantId: reviewRegistration.school.schoolId,
    actorId: 'admin-1',
    payload: {
      schoolId: reviewRegistration.school.schoolId,
      schoolSlug: 'review-u',
      approverEmail: 'admin@campus.test',
    },
  });

  const rejectionRegistration = await reviewService.registerSchool({
    name: 'Reject University',
    representative: 'Alan Reyes',
    email: 'owner@reject.test',
    contactNumber: '+63 900 333 4444',
    schoolType: 'College',
    targetSubdomain: 'reject-u',
  });

  await rejects(
    () =>
      reviewService.rejectSchool(rejectionRegistration.school.schoolId, {
        actorEmail: 'admin@campus.test',
        reason: ' ',
      }),
    BadRequestException,
  );

  const rejected = await reviewService.rejectSchool(rejectionRegistration.school.schoolId, {
    actorEmail: 'admin@campus.test',
    reason: 'Incomplete legal documents',
  });
  strictEqual(rejected.school.status, 'rejected');
  strictEqual(rejected.onboardingStatus, 'rejected');
  strictEqual(rejected.rejectionReason, 'Incomplete legal documents');
  strictEqual(reviewRepository.auditEvents.at(-1)?.action, 'platform.school.rejected');
  deepEqual(reviewEvents.at(-1), {
    eventType: 'school.review.rejected',
    tenantId: rejectionRegistration.school.schoolId,
    actorId: 'admin@campus.test',
    payload: {
      schoolId: rejectionRegistration.school.schoolId,
      schoolSlug: 'reject-u',
      reason: 'Incomplete legal documents',
    },
  });

  const suspended = await reviewService.suspendSchool(reviewRegistration.school.schoolId, {
    actorEmail: 'admin@campus.test',
    reason: 'Billing review',
  });
  strictEqual(suspended.school.status, 'suspended');
  strictEqual(suspended.onboardingStatus, 'suspended');
  strictEqual(reviewRepository.auditEvents.at(-1)?.action, 'platform.school.suspended');

  const reactivated = await reviewService.reactivateSchool(reviewRegistration.school.schoolId, {
    actorEmail: 'admin@campus.test',
  });
  strictEqual(reactivated.school.status, 'approved');
  strictEqual(reactivated.onboardingStatus, 'approved');
  strictEqual(reviewRepository.auditEvents.at(-1)?.action, 'platform.school.reactivated');

  const activationRepository = new MemoryRegistrationRepository();
  const activationService = new PlatformSchoolOnboardingService(activationRepository);
  const activationRegistration = await activationService.registerSchool({
    name: 'Activation University',
    representative: 'Lin Reyes',
    email: 'owner@activation.test',
    contactNumber: '+63 900 555 7777',
    schoolType: 'University',
    targetSubdomain: 'activation-u',
  });
  const ownerToken = 'owner-token-123';
  const ownerTokenHash = createHash('sha256').update(ownerToken).digest('hex');
  activationRepository.ownerInvitations.set(activationRegistration.school.schoolId, {
    institutionId: activationRegistration.school.schoolId,
    email: 'owner@activation.test',
    tokenHash: ownerTokenHash,
    status: 'pending',
  });

  await rejects(() => (activationService as any).activateOwner({}), BadRequestException);
  await rejects(() => (activationService as any).activateOwner({ token: ownerToken, password: 'short' }), BadRequestException);
  await rejects(
    () => (activationService as any).activateOwner({ token: 'missing-token', password: 'secure-password' }),
    NotFoundException,
  );

  const activated = await (activationService as any).activateOwner({ token: ownerToken, password: 'secure-password' });
  strictEqual(activated.school.schoolId, activationRegistration.school.schoolId);
  strictEqual(activated.ownerInvitationStatus, 'accepted');
  strictEqual(activated.next, 'tenant_portal_login');
  strictEqual(activated.portalUrl, 'https://activation-u.itsandbox.site');
  strictEqual(activated.message, 'Owner account created. Continue to the tenant portal.');
  strictEqual(activationRepository.onboardingProgress.get(activationRegistration.school.schoolId)?.currentStep, 'owner_account_created');
  strictEqual(activationRepository.auditEvents.at(-1)?.action, 'platform.school.owner_account_created');
  strictEqual(activationRepository.ownerAccounts.get('owner@activation.test')?.role, 'school_owner');
  strictEqual(activationRepository.ownerAccounts.get('owner@activation.test')?.passwordHash.startsWith('scrypt$'), true);

  const hashActivationRepository = new MemoryRegistrationRepository();
  const hashActivationService = new PlatformSchoolOnboardingService(hashActivationRepository);
  const hashActivationRegistration = await hashActivationService.registerSchool({
    name: 'Hash Activation University',
    representative: 'Nora Santos',
    email: 'owner@hash-activation.test',
    contactNumber: '+63 900 555 8888',
    schoolType: 'University',
    targetSubdomain: 'hash-activation-u',
  });
  hashActivationRepository.ownerInvitations.set(hashActivationRegistration.school.schoolId, {
    institutionId: hashActivationRegistration.school.schoolId,
    email: 'owner@hash-activation.test',
    tokenHash: ownerTokenHash,
    status: 'pending',
  });

  const hashActivated = await (hashActivationService as any).activateOwner({
    tokenHash: ownerTokenHash,
    password: 'secure-password',
  });
  strictEqual(hashActivated.ownerInvitationStatus, 'accepted');
  strictEqual(hashActivated.next, 'tenant_portal_login');

  const pgPool = new SchemaCheckingPool();
  const pgIdentityPool = new SchemaCheckingPool('identity_access');
  const pgRepository = new PostgresPlatformSchoolRegistrationRepository();
  (pgRepository as any).pool = pgPool;
  (pgRepository as any).identityPool = pgIdentityPool;

  const pgRecord = await pgRepository.createRegistrationBundle({
    school: {
      id: '10000000-0000-0000-0000-000000000099',
      name: 'Schema University',
      representative: 'Schema Owner',
      contactEmail: 'owner@schema.test',
      contactNumber: '+63 900 000 0099',
      schoolType: 'University',
      targetSubdomain: 'schema-u',
      status: 'pending_review',
    },
    onboardingProgress: {
      institutionId: '10000000-0000-0000-0000-000000000099',
      currentStep: 'owner_activation',
      completedSteps: ['registration_submitted'],
      status: 'pending_review',
    },
    ownerInvitation: {
      institutionId: '10000000-0000-0000-0000-000000000099',
      email: 'owner@schema.test',
      tokenHash: 'a'.repeat(64),
      status: 'pending',
    },
    auditEvent: {
      institutionId: '10000000-0000-0000-0000-000000000099',
      action: 'platform.school.registered',
      actorEmail: 'owner@schema.test',
      metadata: { schoolSlug: 'schema-u' },
    },
  });
  strictEqual(pgRecord.targetSubdomain, 'schema-u');

  const pgApproved = await pgRepository.approveSchoolReview('10000000-0000-0000-0000-000000000099', {
    approverId: '20000000-0000-0000-0000-000000000099',
    approverEmail: 'admin@schema.test',
    approvedAt: '2026-05-25T00:00:00.000Z',
  });
  strictEqual(pgApproved?.school.status, 'approved');

  const pgActivated = await pgRepository.acceptOwnerInvitation({
    institutionId: '10000000-0000-0000-0000-000000000099',
    tokenHash: 'a'.repeat(64),
    acceptedAt: '2026-05-25T01:00:00.000Z',
    ownerAccount: {
      id: '30000000-0000-0000-0000-000000000099',
      institutionId: '10000000-0000-0000-0000-000000000099',
      email: 'owner@schema.test',
      passwordHash: 'scrypt$salt$hash',
      role: 'school_owner',
    },
  });
  strictEqual(pgActivated?.ownerInvitationStatus, 'accepted');
  strictEqual(pgIdentityPool.queries.some((query) => query.text.includes('insert into portal_accounts')), true);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
