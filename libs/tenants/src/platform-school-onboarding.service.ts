import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type {
  SchoolApproveRequest,
  SchoolOnboardingStatus,
  SchoolOwnerActivationRequest,
  SchoolOwnerActivationResponse,
  SchoolOwnerInvitationStatus,
  SchoolRegistrationAuditAction,
  SchoolRegistrationRequest,
  SchoolRegistrationResponse,
  SchoolReviewActionRequest,
  SchoolReviewListResponse,
  SchoolReviewRecord,
  SchoolSlugAvailabilityResponse,
} from '@campus-one/contracts';
import { createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto';

const RESERVED_SCHOOL_SLUGS = new Set(['api', 'app', 'www', 'admin', 'status', 'portal', 'campus', 'localhost']);

export type SchoolRegistrationRecord = {
  id: string;
  name: string;
  representative: string;
  contactEmail: string;
  contactNumber: string;
  schoolType: string;
  targetSubdomain: string;
  status: SchoolOnboardingStatus;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectionReason?: string | null;
};

export type SchoolOnboardingProgressRecord = {
  institutionId: string;
  currentStep: string;
  completedSteps: string[];
  status: SchoolOnboardingStatus;
};

export type SchoolOwnerInvitationRecord = {
  institutionId: string;
  email: string;
  tokenHash: string;
  status: SchoolOwnerInvitationStatus;
  acceptedAt?: string | null;
};

export type SchoolOwnerAccountRecord = {
  id: string;
  institutionId: string;
  email: string;
  passwordHash: string;
  role: 'school_owner';
};

export type SchoolRegistrationAuditEvent = {
  institutionId: string;
  action: SchoolRegistrationAuditAction;
  actorEmail?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: string;
};

export type SchoolRegistrationBundle = {
  school: SchoolRegistrationRecord;
  onboardingProgress: SchoolOnboardingProgressRecord;
  ownerInvitation: SchoolOwnerInvitationRecord;
  auditEvent: SchoolRegistrationAuditEvent;
};

export type SchoolRegistrationConfirmationEmail = {
  to: string;
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  nextStep: 'platform_review';
};

export interface PlatformSchoolOnboardingEmailNotifier {
  sendSchoolRegistrationConfirmation(payload: SchoolRegistrationConfirmationEmail): Promise<void>;
}

export interface PlatformSchoolRegistrationRepository {
  findBySlug(slug: string): Promise<SchoolRegistrationRecord | null>;
  createRegistrationBundle(bundle: SchoolRegistrationBundle): Promise<SchoolRegistrationRecord>;
  listReviewRecords(): Promise<SchoolReviewRecord[]>;
  findReviewRecordById(id: string): Promise<SchoolReviewRecord | null>;
  approveSchoolReview(id: string, input: SchoolApproveRequest & { approvedAt: string }): Promise<SchoolReviewRecord | null>;
  rejectSchoolReview(id: string, input: Required<Pick<SchoolReviewActionRequest, 'reason'>> & { actorEmail?: string }): Promise<SchoolReviewRecord | null>;
  suspendSchool(id: string, input: SchoolReviewActionRequest): Promise<SchoolReviewRecord | null>;
  reactivateSchool(id: string, input: SchoolReviewActionRequest): Promise<SchoolReviewRecord | null>;
  findOwnerInvitationByTokenHash(tokenHash: string): Promise<SchoolOwnerInvitationRecord | null>;
  acceptOwnerInvitation(input: {
    institutionId: string;
    tokenHash: string;
    acceptedAt: string;
    ownerAccount: SchoolOwnerAccountRecord;
  }): Promise<SchoolReviewRecord | null>;
}

export const PLATFORM_SCHOOL_REGISTRATION_REPOSITORY = Symbol('PLATFORM_SCHOOL_REGISTRATION_REPOSITORY');
export const PLATFORM_SCHOOL_ONBOARDING_EMAIL_NOTIFIER = Symbol('PLATFORM_SCHOOL_ONBOARDING_EMAIL_NOTIFIER');

export class PostgresPlatformSchoolRegistrationRepository implements PlatformSchoolRegistrationRepository {
  private pool: any;

  async findBySlug(slug: string): Promise<SchoolRegistrationRecord | null> {
    const result = await this.query(
      `
        select
          id,
          name,
          representative,
          email as "contactEmail",
          contact_number as "contactNumber",
          school_type as "schoolType",
          target_subdomain as "targetSubdomain",
          status
        from institution_profiles
        where lower(target_subdomain) = lower($1)
          and status in ('pending_review', 'approved', 'suspended')
        limit 1
      `,
      [slug],
    );

    return result.rows[0] ?? null;
  }

  async createRegistrationBundle(bundle: SchoolRegistrationBundle): Promise<SchoolRegistrationRecord> {
    const client = await this.getPool().connect();
    try {
      await client.query('begin');
      const result = await client.query(
      `
        insert into institution_profiles (
          id,
          name,
          representative,
          email,
          contact_number,
          school_type,
          target_subdomain,
          status,
          setup_progress
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 0)
        returning
          id,
          name,
          representative,
          email as "contactEmail",
          contact_number as "contactNumber",
          school_type as "schoolType",
          target_subdomain as "targetSubdomain",
          status
      `,
      [
        bundle.school.id,
        bundle.school.name,
        bundle.school.representative,
        bundle.school.contactEmail,
        bundle.school.contactNumber,
        bundle.school.schoolType,
        bundle.school.targetSubdomain,
        bundle.school.status,
      ],
      );

      await client.query(
        `
          insert into onboarding_progress (institution_id, current_step, completed_steps, status)
          values ($1, $2, $3, $4)
        `,
        [
          bundle.onboardingProgress.institutionId,
          bundle.onboardingProgress.currentStep,
          JSON.stringify(bundle.onboardingProgress.completedSteps),
          bundle.onboardingProgress.status,
        ],
      );

      await client.query(
        `
          insert into school_owner_invitations (institution_id, email, token_hash, status)
          values ($1, $2, $3, $4)
        `,
        [
          bundle.ownerInvitation.institutionId,
          bundle.ownerInvitation.email,
          bundle.ownerInvitation.tokenHash,
          bundle.ownerInvitation.status,
        ],
      );

      await client.query(
        `
          insert into audit_events (institution_id, action, actor_email, metadata)
          values ($1, $2, $3, $4)
        `,
        [
          bundle.auditEvent.institutionId,
          bundle.auditEvent.action,
          bundle.auditEvent.actorEmail,
          JSON.stringify(bundle.auditEvent.metadata),
        ],
      );

      await client.query('commit');
      return result.rows[0];
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async listReviewRecords(): Promise<SchoolReviewRecord[]> {
    const result = await this.query(this.reviewRecordSql(), []);
    return result.rows.map((row: any) => this.mapReviewRow(row));
  }

  async findReviewRecordById(id: string): Promise<SchoolReviewRecord | null> {
    const result = await this.query(this.reviewRecordSql('where p.id = $1'), [id]);
    return result.rows[0] ? this.mapReviewRow(result.rows[0]) : null;
  }

  async approveSchoolReview(
    id: string,
    input: SchoolApproveRequest & { approvedAt: string },
  ): Promise<SchoolReviewRecord | null> {
    return this.updateReviewStatus(id, {
      status: 'approved',
      currentStep: 'owner_activation',
      completedSteps: ['registration_submitted', 'platform_review_approved'],
      actorEmail: input.approverEmail,
      action: 'platform.school.approved',
      metadata: { approverId: input.approverId },
      approvedAt: input.approvedAt,
      approvedBy: input.approverId,
      rejectionReason: null,
    });
  }

  async rejectSchoolReview(
    id: string,
    input: Required<Pick<SchoolReviewActionRequest, 'reason'>> & { actorEmail?: string },
  ): Promise<SchoolReviewRecord | null> {
    return this.updateReviewStatus(id, {
      status: 'rejected',
      currentStep: 'platform_review',
      completedSteps: ['registration_submitted'],
      actorEmail: input.actorEmail,
      action: 'platform.school.rejected',
      metadata: { reason: input.reason },
      approvedAt: null,
      approvedBy: null,
      rejectionReason: input.reason,
    });
  }

  async suspendSchool(id: string, input: SchoolReviewActionRequest): Promise<SchoolReviewRecord | null> {
    return this.updateReviewStatus(id, {
      status: 'suspended',
      currentStep: 'suspended',
      completedSteps: ['registration_submitted', 'platform_review_approved'],
      actorEmail: input.actorEmail,
      action: 'platform.school.suspended',
      metadata: input.reason ? { reason: input.reason } : {},
    });
  }

  async reactivateSchool(id: string, input: SchoolReviewActionRequest): Promise<SchoolReviewRecord | null> {
    return this.updateReviewStatus(id, {
      status: 'approved',
      currentStep: 'owner_activation',
      completedSteps: ['registration_submitted', 'platform_review_approved'],
      actorEmail: input.actorEmail,
      action: 'platform.school.reactivated',
      metadata: input.reason ? { reason: input.reason } : {},
      rejectionReason: null,
    });
  }

  async findOwnerInvitationByTokenHash(tokenHash: string): Promise<SchoolOwnerInvitationRecord | null> {
    const result = await this.query(
      `
        select
          institution_id as "institutionId",
          email,
          token_hash as "tokenHash",
          status,
          accepted_at as "acceptedAt"
        from school_owner_invitations
        where token_hash = $1
          and status = 'pending'
        limit 1
      `,
      [tokenHash],
    );

    return result.rows[0] ?? null;
  }

  async acceptOwnerInvitation(input: {
    institutionId: string;
    tokenHash: string;
    acceptedAt: string;
    ownerAccount: SchoolOwnerAccountRecord;
  }): Promise<SchoolReviewRecord | null> {
    const client = await this.getPool().connect();
    try {
      await client.query('begin');

      const invitationResult = await client.query(
        `
          update school_owner_invitations
          set status = 'accepted', accepted_at = $3
          where institution_id = $1
            and token_hash = $2
            and status = 'pending'
          returning institution_id as "institutionId", email
        `,
        [input.institutionId, input.tokenHash, input.acceptedAt],
      );

      const invitation = invitationResult.rows[0];
      if (!invitation) {
        await client.query('rollback');
        return null;
      }

      await client.query(
        `
          insert into portal_accounts (id, email, password_hash)
          values ($1, $2, $3)
        `,
        [input.ownerAccount.id, input.ownerAccount.email, input.ownerAccount.passwordHash],
      );

      await client.query(
        `
          insert into school_owner_accounts (id, institution_id, email, role)
          values ($1, $2, $3, $4)
        `,
        [
          input.ownerAccount.id,
          input.ownerAccount.institutionId,
          input.ownerAccount.email,
          input.ownerAccount.role,
        ],
      );

      await client.query(
        `
          update onboarding_progress
          set
            current_step = 'owner_account_created',
            completed_steps = case
              when completed_steps ? 'owner_account_created' then completed_steps
              else completed_steps || '["owner_invitation_accepted", "owner_account_created"]'::jsonb
            end,
            updated_at = now()
          where institution_id = $1
        `,
        [input.institutionId],
      );

      await client.query(
        `
          insert into audit_events (institution_id, action, actor_email, metadata, created_at)
          values ($1, $2, $3, $4, $5)
        `,
        [
          input.institutionId,
          'platform.school.owner_account_created',
          invitation.email,
          JSON.stringify({ next: 'tenant_portal_login' }),
          input.acceptedAt,
        ],
      );

      await client.query('commit');
      return this.findReviewRecordById(input.institutionId);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async query(text: string, values: unknown[]) {
    return this.getPool().query(text, values);
  }

  private async updateReviewStatus(
    id: string,
    input: {
      status: SchoolOnboardingStatus;
      currentStep: string;
      completedSteps: string[];
      actorEmail?: string | null;
      action: SchoolRegistrationAuditAction;
      metadata: Record<string, unknown>;
      approvedAt?: string | null;
      approvedBy?: string | null;
      rejectionReason?: string | null;
    },
  ): Promise<SchoolReviewRecord | null> {
    const client = await this.getPool().connect();
    try {
      await client.query('begin');
      const existing = await client.query('select id from institution_profiles where id = $1 limit 1', [id]);
      if (!existing.rows[0]) {
        await client.query('rollback');
        return null;
      }

      await client.query(
        `
          update institution_profiles
          set
            status = $2,
            approved_at = coalesce($3, approved_at),
            approved_by = coalesce($4, approved_by),
            rejection_reason = $5
          where id = $1
        `,
        [id, input.status, input.approvedAt, input.approvedBy, input.rejectionReason],
      );

      await client.query(
        `
          update onboarding_progress
          set current_step = $2, completed_steps = $3, status = $4, updated_at = now()
          where institution_id = $1
        `,
        [id, input.currentStep, JSON.stringify(input.completedSteps), input.status],
      );

      await client.query(
        `
          insert into audit_events (institution_id, action, actor_email, metadata)
          values ($1, $2, $3, $4)
        `,
        [id, input.action, input.actorEmail ?? null, JSON.stringify(input.metadata)],
      );

      await client.query('commit');
      return this.findReviewRecordById(id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private reviewRecordSql(whereClause = ''): string {
    return `
      select
        p.id,
        p.name,
        p.representative,
        p.email as "contactEmail",
        p.contact_number as "contactNumber",
        p.school_type as "schoolType",
        p.target_subdomain as "targetSubdomain",
        p.status,
        p.approved_at as "approvedAt",
        p.approved_by as "approvedBy",
        p.rejection_reason as "rejectionReason",
        op.status as "onboardingStatus",
        oi.status as "ownerInvitationStatus",
        coalesce(
          json_agg(
            json_build_object(
              'action', ae.action,
              'actorEmail', ae.actor_email,
              'metadata', ae.metadata,
              'createdAt', ae.created_at
            )
            order by ae.created_at asc
          ) filter (where ae.id is not null),
          '[]'::json
        ) as "auditTrail"
      from institution_profiles p
      left join onboarding_progress op on op.institution_id = p.id
      left join lateral (
        select status
        from school_owner_invitations
        where institution_id = p.id
        order by created_at desc
        limit 1
      ) oi on true
      left join audit_events ae on ae.institution_id = p.id
      ${whereClause}
      group by p.id, op.status, oi.status
    `;
  }

  private mapReviewRow(row: any): SchoolReviewRecord {
    return {
      school: {
        schoolId: row.id,
        schoolSlug: row.targetSubdomain,
        displayName: row.name,
        schoolType: row.schoolType,
        status: row.status,
      },
      representative: row.representative,
      contactEmail: row.contactEmail,
      contactNumber: row.contactNumber,
      schoolType: row.schoolType,
      ownerInvitationStatus: row.ownerInvitationStatus as SchoolOwnerInvitationStatus | undefined,
      onboardingStatus: (row.onboardingStatus ?? row.status) as SchoolOnboardingStatus,
      approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
      approvedBy: row.approvedBy ?? null,
      rejectionReason: row.rejectionReason ?? null,
      auditTrail: Array.isArray(row.auditTrail)
        ? row.auditTrail.map((event: any) => ({
            ...event,
            createdAt: event.createdAt ? new Date(event.createdAt).toISOString() : undefined,
          }))
        : [],
    };
  }

  private getPool() {
    if (!this.pool) {
      const databaseUrl = process.env.DATABASE_URL || process.env.TENANT_REGISTRY_DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL or TENANT_REGISTRY_DATABASE_URL must be configured.');
      }

      const { Pool } = require('pg');
      this.pool = new Pool({ connectionString: databaseUrl });
    }

    return this.pool;
  }
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function validateRequired(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new BadRequestException(`${label} is required.`);
  return normalized;
}

function createInvitationTokenHash(): string {
  const token = randomBytes(32).toString('base64url');
  return createHash('sha256').update(token).digest('hex');
}

function hashOwnerPassword(password: string, salt = randomBytes(16).toString('base64url')): string {
  const hash = scryptSync(password, salt, 64).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

function validatePassword(value: string | undefined): string {
  const password = value?.trim();
  if (!password || password.length < 8) {
    throw new BadRequestException('Owner account password must be at least 8 characters.');
  }
  return password;
}

function buildTenantPortalUrl(schoolSlug: string): string {
  const domain = process.env.CAMPUS_ONE_TENANT_PORTAL_DOMAIN ?? 'itsandbox.site';
  const protocol = domain.startsWith('localhost') || domain.startsWith('127.0.0.1') ? 'http' : 'https';
  if (domain.startsWith('localhost') || domain.startsWith('127.0.0.1')) {
    return `${protocol}://${domain}?school=${encodeURIComponent(schoolSlug)}`;
  }
  return `${protocol}://${schoolSlug}.${domain}`;
}

function requireReviewRecord(record: SchoolReviewRecord | null): SchoolReviewRecord {
  if (!record) throw new NotFoundException('School registration was not found.');
  return record;
}

@Injectable()
export class PlatformSchoolOnboardingService {
  constructor(
    @Inject(PLATFORM_SCHOOL_REGISTRATION_REPOSITORY)
    private readonly repository: PlatformSchoolRegistrationRepository = new PostgresPlatformSchoolRegistrationRepository(),
    @Optional()
    @Inject(PLATFORM_SCHOOL_ONBOARDING_EMAIL_NOTIFIER)
    private readonly emailNotifier?: PlatformSchoolOnboardingEmailNotifier,
  ) {}

  async registerSchool(dto: SchoolRegistrationRequest): Promise<SchoolRegistrationResponse> {
    const name = validateRequired(dto.name, 'School name');
    const representative = validateRequired(dto.representative, 'Representative name');
    const email = validateRequired(dto.email, 'Contact email').toLowerCase();
    const contactNumber = validateRequired(dto.contactNumber, 'Contact number');
    const schoolType = validateRequired(dto.schoolType, 'School type');
    const targetSubdomain = normalizeSlug(validateRequired(dto.targetSubdomain, 'Target subdomain'));

    if (!targetSubdomain || RESERVED_SCHOOL_SLUGS.has(targetSubdomain)) {
      throw new BadRequestException('Target subdomain is reserved or invalid.');
    }

    const existing = await this.repository.findBySlug(targetSubdomain);
    if (existing) {
      throw new ConflictException('Target subdomain is already registered.');
    }

    const school: SchoolRegistrationRecord = {
      id: randomUUID(),
      name,
      representative,
      contactEmail: email,
      contactNumber,
      schoolType,
      targetSubdomain,
      status: 'pending_review',
    };

    const record = await this.repository.createRegistrationBundle({
      school,
      onboardingProgress: {
        institutionId: school.id,
        currentStep: 'owner_activation',
        completedSteps: ['registration_submitted'],
        status: 'pending_review',
      },
      ownerInvitation: {
        institutionId: school.id,
        email,
        tokenHash: createInvitationTokenHash(),
        status: 'pending',
      },
      auditEvent: {
        institutionId: school.id,
        action: 'platform.school.registered',
        actorEmail: email,
        metadata: {
          schoolSlug: targetSubdomain,
          schoolType,
        },
      },
    });

    await this.emailNotifier?.sendSchoolRegistrationConfirmation({
      to: email,
      schoolId: record.id,
      schoolSlug: record.targetSubdomain,
      schoolName: record.name,
      nextStep: 'platform_review',
    });

    return {
      message: 'School registration submitted for review.',
      school: {
        schoolId: record.id,
        schoolSlug: record.targetSubdomain,
        displayName: record.name,
        schoolType: record.schoolType,
        status: record.status,
      },
      next: 'platform_review',
      ownerInvitationStatus: 'pending',
      onboardingStatus: 'pending_review',
    };
  }

  async checkSlugAvailability(slugInput: string): Promise<SchoolSlugAvailabilityResponse> {
    const slug = normalizeSlug(slugInput ?? '');

    if (!slug) {
      return { slug, available: false, reason: 'invalid' };
    }

    if (RESERVED_SCHOOL_SLUGS.has(slug)) {
      return { slug, available: false, reason: 'reserved' };
    }

    const existing = await this.repository.findBySlug(slug);
    if (existing) {
      return { slug, available: false, reason: 'existing' };
    }

    return { slug, available: true };
  }

  async activateOwner(input: SchoolOwnerActivationRequest): Promise<SchoolOwnerActivationResponse> {
    const tokenHash = this.resolveOwnerActivationTokenHash(input);
    const password = validatePassword(input.password);
    const invitation = await this.repository.findOwnerInvitationByTokenHash(tokenHash);
    if (!invitation) throw new NotFoundException('Owner invitation token is invalid or expired.');

    const accepted = await this.repository.acceptOwnerInvitation({
      institutionId: invitation.institutionId,
      tokenHash,
      acceptedAt: new Date().toISOString(),
      ownerAccount: {
        id: randomUUID(),
        institutionId: invitation.institutionId,
        email: invitation.email,
        passwordHash: hashOwnerPassword(password),
        role: 'school_owner',
      },
    });

    const record = requireReviewRecord(accepted);
    const portalUrl = buildTenantPortalUrl(record.school.schoolSlug);
    return {
      message: 'Owner account created. Continue to the tenant portal.',
      school: record.school,
      next: 'tenant_portal_login',
      portalUrl,
      ownerInvitationStatus: 'accepted',
      onboardingStatus: record.onboardingStatus,
    };
  }

  async listSchools(): Promise<SchoolReviewListResponse> {
    return { schools: await this.repository.listReviewRecords() };
  }

  async getSchool(id: string): Promise<SchoolReviewRecord> {
    return requireReviewRecord(await this.repository.findReviewRecordById(id));
  }

  async approveSchool(id: string, input: SchoolApproveRequest): Promise<SchoolReviewRecord> {
    const approverId = validateRequired(input.approverId, 'Approver id');
    return requireReviewRecord(
      await this.repository.approveSchoolReview(id, {
        approverId,
        approverEmail: input.approverEmail?.trim() || undefined,
        approvedAt: new Date().toISOString(),
      }),
    );
  }

  async rejectSchool(id: string, input: SchoolReviewActionRequest): Promise<SchoolReviewRecord> {
    const reason = validateRequired(input.reason, 'Rejection reason');
    return requireReviewRecord(
      await this.repository.rejectSchoolReview(id, {
        actorEmail: input.actorEmail?.trim() || undefined,
        reason,
      }),
    );
  }

  async suspendSchool(id: string, input: SchoolReviewActionRequest): Promise<SchoolReviewRecord> {
    return requireReviewRecord(
      await this.repository.suspendSchool(id, {
        actorEmail: input.actorEmail?.trim() || undefined,
        reason: input.reason?.trim() || undefined,
      }),
    );
  }

  async reactivateSchool(id: string, input: SchoolReviewActionRequest): Promise<SchoolReviewRecord> {
    return requireReviewRecord(
      await this.repository.reactivateSchool(id, {
        actorEmail: input.actorEmail?.trim() || undefined,
        reason: input.reason?.trim() || undefined,
      }),
    );
  }

  private resolveOwnerActivationTokenHash(input: SchoolOwnerActivationRequest): string {
    const tokenHash = input.tokenHash?.trim();
    if (tokenHash) return tokenHash.toLowerCase();

    const token = input.token?.trim();
    if (!token) throw new BadRequestException('Owner activation token is required.');

    return createHash('sha256').update(token).digest('hex');
  }
}
