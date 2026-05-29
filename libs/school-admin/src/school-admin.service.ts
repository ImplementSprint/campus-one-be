import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

const ACADEMIC_RESOURCE_TYPES = [
  'departments',
  'programs',
  'subjects',
  'curricula',
  'sections',
  'rooms',
  'class-assignments',
  'terms',
] as const;

const USER_ROLES = [
  'school_owner',
  'school_admin',
  'registrar',
  'professor',
  'student',
  'alumni_admin',
] as const;

const USER_STATUSES = ['pending', 'active', 'inactive'] as const;

export type AcademicResourceType = typeof ACADEMIC_RESOURCE_TYPES[number];
export type SchoolUserRole = typeof USER_ROLES[number];
export type SchoolUserStatus = typeof USER_STATUSES[number];

export type SchoolAdminRecord = {
  id: string;
  institutionId: string;
  resourceType: string;
  data: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type SchoolAdminRepository = {
  getProfile(institutionId: string): Promise<Record<string, unknown> | null>;
  upsertProfile(institutionId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  listRecords(institutionId: string, resourceType: string, filters?: Record<string, string>): Promise<SchoolAdminRecord[]>;
  getRecord(institutionId: string, resourceType: string, id: string): Promise<SchoolAdminRecord | null>;
  upsertRecord(record: SchoolAdminRecord): Promise<SchoolAdminRecord>;
  deleteRecord(institutionId: string, resourceType: string, id: string): Promise<boolean>;
  recordAudit(input: Record<string, unknown>): Promise<unknown>;
  queueDelivery(input: Record<string, unknown>): Promise<unknown>;
};

type Queryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
};

@Injectable()
export class SchoolAdminService {
  private readonly repository: SchoolAdminRepository;

  constructor(
    @Optional()
    @Inject('SchoolAdminRepository')
    repository?: SchoolAdminRepository,
  ) {
    this.repository = repository ?? new PostgresSchoolAdminRepository();
  }

  async getProfile(institutionId: string) {
    this.assertInstitution(institutionId);
    return this.repository.getProfile(institutionId) ?? {
      id: institutionId,
      name: '',
      logoUrl: null,
      theme: null,
      academicCalendar: null,
      gradingScale: null,
      enrollmentPeriod: null,
      admissionsPeriod: null,
    };
  }

  async updateProfile(institutionId: string, actorId: string, payload: Record<string, unknown>) {
    this.assertInstitution(institutionId);
    this.assertActor(actorId);
    const profile = await this.repository.upsertProfile(institutionId, sanitizeObject(payload));
    await this.audit(institutionId, actorId, 'school_admin.profile.updated', profile.id as string, {
      changedFields: Object.keys(payload),
    });
    return profile;
  }

  async inviteUser(institutionId: string, actorId: string, payload: Record<string, unknown>): Promise<Record<string, any>> {
    const email = this.normalizeEmail(payload.email);
    const role = this.assertRole(payload.role);
    const invitation = await this.writeRecord(institutionId, 'user-invitations', {
      email,
      role,
      displayName: cleanString(payload.displayName),
      status: 'pending',
      invitedAt: new Date().toISOString(),
      expiresAt: cleanString(payload.expiresAt) ?? defaultInvitationExpiry(),
    });
    await this.repository.queueDelivery({
      channel: 'email',
      template: 'school_user_invitation',
      institutionId,
      recipient: email,
      actorId,
      payload: invitation.data,
    });
    await this.audit(institutionId, actorId, 'school_admin.user.invited', invitation.id, {
      email,
      role,
    });
    return { id: invitation.id, ...(invitation.data as Record<string, any>) };
  }

  async createUser(institutionId: string, actorId: string, payload: Record<string, unknown>): Promise<Record<string, any>> {
    const email = this.normalizeEmail(payload.email);
    const role = this.assertRole(payload.role);
    const user = await this.writeRecord(institutionId, 'school-users', {
      email,
      role,
      displayName: cleanString(payload.displayName),
      status: this.assertStatus(payload.status ?? 'active'),
      createdAt: new Date().toISOString(),
    });
    await this.audit(institutionId, actorId, 'school_admin.user.created', user.id, {
      email,
      role,
    });
    return { id: user.id, ...(user.data as Record<string, any>) };
  }

  async listUsers(institutionId: string, filters: { role?: string; status?: string } = {}): Promise<Array<Record<string, any>>> {
    const normalizedFilters: Record<string, string> = {};
    if (filters.role) normalizedFilters.role = this.assertRole(filters.role);
    if (filters.status) normalizedFilters.status = this.assertStatus(filters.status);
    const records = await this.repository.listRecords(institutionId, 'school-users', normalizedFilters);
    return records.map((record) => ({ id: record.id, ...(record.data as Record<string, any>) }));
  }

  async assignRole(institutionId: string, actorId: string, userId: string, role: string): Promise<Record<string, any>> {
    const user = await this.requireRecord(institutionId, 'school-users', userId);
    const nextRole = this.assertRole(role);
    const updated = await this.writeRecord(institutionId, 'school-users', {
      ...user.data,
      role: nextRole,
      roleUpdatedAt: new Date().toISOString(),
    }, user.id);
    await this.audit(institutionId, actorId, 'school_admin.user.role_assigned', userId, {
      role: nextRole,
    });
    return { id: updated.id, ...(updated.data as Record<string, any>) };
  }

  async assignAlumniAdmin(institutionId: string, actorId: string, userId: string) {
    return this.assignRole(institutionId, actorId, userId, 'alumni_admin');
  }

  async setUserStatus(institutionId: string, actorId: string, userId: string, status: string): Promise<Record<string, any>> {
    const user = await this.requireRecord(institutionId, 'school-users', userId);
    const nextStatus = this.assertStatus(status);
    const updated = await this.writeRecord(institutionId, 'school-users', {
      ...user.data,
      status: nextStatus,
      statusUpdatedAt: new Date().toISOString(),
    }, user.id);
    await this.audit(institutionId, actorId, `school_admin.user.${nextStatus === 'active' ? 'reactivated' : 'deactivated'}`, userId, {
      status: nextStatus,
    });
    return { id: updated.id, ...(updated.data as Record<string, any>) };
  }

  async queuePasswordReset(institutionId: string, actorId: string, userId: string) {
    const user = await this.requireRecord(institutionId, 'school-users', userId);
    await this.repository.queueDelivery({
      channel: 'email',
      template: 'school_user_password_reset',
      institutionId,
      recipient: user.data.email,
      actorId,
      payload: { userId },
    });
    await this.audit(institutionId, actorId, 'school_admin.user.password_reset_queued', userId, {});
    return { queued: true, userId };
  }

  async resendInvite(institutionId: string, actorId: string, invitationId: string) {
    const invitation = await this.requireRecord(institutionId, 'user-invitations', invitationId);
    await this.repository.queueDelivery({
      channel: 'email',
      template: 'school_user_invitation',
      institutionId,
      recipient: invitation.data.email,
      actorId,
      payload: invitation.data,
    });
    await this.audit(institutionId, actorId, 'school_admin.user.invite_resent', invitationId, {});
    return { queued: true, invitationId };
  }

  async createAcademicRecord(
    institutionId: string,
    actorId: string,
    resourceType: string,
    payload: Record<string, unknown>,
  ) {
    const normalizedType = this.assertAcademicResource(resourceType);
    const record = await this.writeRecord(institutionId, normalizedType, payload);
    await this.audit(institutionId, actorId, `school_admin.academic.${normalizedType}.created`, record.id, {});
    return record;
  }

  async listAcademicRecords(institutionId: string, resourceType: string) {
    const normalizedType = this.assertAcademicResource(resourceType);
    return this.repository.listRecords(institutionId, normalizedType);
  }

  async updateAcademicRecord(
    institutionId: string,
    actorId: string,
    resourceType: string,
    id: string,
    payload: Record<string, unknown>,
  ) {
    const normalizedType = this.assertAcademicResource(resourceType);
    const existing = await this.requireRecord(institutionId, normalizedType, id);
    const record = await this.writeRecord(institutionId, normalizedType, { ...existing.data, ...payload }, id);
    await this.audit(institutionId, actorId, `school_admin.academic.${normalizedType}.updated`, id, {});
    return record;
  }

  async deleteAcademicRecord(institutionId: string, actorId: string, resourceType: string, id: string) {
    const normalizedType = this.assertAcademicResource(resourceType);
    await this.requireRecord(institutionId, normalizedType, id);
    const deleted = await this.repository.deleteRecord(institutionId, normalizedType, id);
    if (!deleted) throw new NotFoundException('Academic record not found');
    await this.audit(institutionId, actorId, `school_admin.academic.${normalizedType}.deleted`, id, {});
    return { id, deleted: true };
  }

  async importAcademicRecords(institutionId: string, actorId: string, resourceType: string, rows: Array<Record<string, unknown>>) {
    if (!Array.isArray(rows)) throw new BadRequestException('Import payload must be an array');
    const created = [];
    for (const row of rows) {
      created.push(await this.createAcademicRecord(institutionId, actorId, resourceType, row));
    }
    await this.audit(institutionId, actorId, `school_admin.academic.${resourceType}.imported`, null, {
      imported: created.length,
    });
    return { imported: created.length, records: created };
  }

  async exportAcademicRecords(institutionId: string, resourceType: string) {
    const normalizedType = this.assertAcademicResource(resourceType);
    const records = await this.repository.listRecords(institutionId, normalizedType);
    return { resourceType: normalizedType, records };
  }

  private async writeRecord(
    institutionId: string,
    resourceType: string,
    payload: Record<string, unknown>,
    id = `${resourceType}-${randomUUID()}`,
  ) {
    this.assertInstitution(institutionId);
    return this.repository.upsertRecord({
      id,
      institutionId,
      resourceType,
      data: sanitizeObject(payload),
      updatedAt: new Date().toISOString(),
    });
  }

  private async requireRecord(institutionId: string, resourceType: string, id: string) {
    const record = await this.repository.getRecord(institutionId, resourceType, id);
    if (!record) throw new NotFoundException('Record not found');
    return record;
  }

  private assertAcademicResource(resourceType: string): AcademicResourceType {
    const normalized = resourceType?.trim() as AcademicResourceType;
    if (!ACADEMIC_RESOURCE_TYPES.includes(normalized)) {
      throw new BadRequestException(`Unsupported academic resource: ${resourceType}`);
    }
    return normalized;
  }

  private assertRole(role: unknown): SchoolUserRole {
    const value = cleanString(role) as SchoolUserRole | undefined;
    if (!value || !USER_ROLES.includes(value)) throw new BadRequestException('Unsupported user role');
    return value;
  }

  private assertStatus(status: unknown): SchoolUserStatus {
    const value = cleanString(status) as SchoolUserStatus | undefined;
    if (!value || !USER_STATUSES.includes(value)) throw new BadRequestException('Unsupported user status');
    return value;
  }

  private normalizeEmail(email: unknown) {
    const value = cleanString(email)?.toLowerCase();
    if (!value || !value.includes('@')) throw new BadRequestException('Valid email is required');
    return value;
  }

  private assertInstitution(institutionId: string) {
    if (!institutionId?.trim()) throw new BadRequestException('Institution id is required');
  }

  private assertActor(actorId: string) {
    if (!actorId?.trim()) throw new BadRequestException('Actor id is required');
  }

  private async audit(
    institutionId: string,
    actorId: string,
    action: string,
    target: string | null,
    metadata: Record<string, unknown>,
  ) {
    await this.repository.recordAudit({
      institutionId,
      actorId,
      action,
      target,
      metadata,
    });
  }
}

export class PostgresSchoolAdminRepository implements SchoolAdminRepository {
  private pool?: Queryable;

  constructor(private readonly queryable?: Queryable) {}

  async getProfile(institutionId: string) {
    const result = await this.query(
      `
        select data
        from school_admin_profiles
        where institution_id = $1
      `,
      [institutionId],
    );
    const row = result.rows[0];
    return row ? { id: institutionId, ...(row.data ?? {}) } : null;
  }

  async upsertProfile(institutionId: string, payload: Record<string, unknown>) {
    const result = await this.query(
      `
        insert into school_admin_profiles (institution_id, data, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (institution_id) do update
          set data = school_admin_profiles.data || excluded.data,
              updated_at = now()
        returning data
      `,
      [institutionId, payload],
    );
    return { id: institutionId, ...(result.rows[0]?.data ?? payload) };
  }

  async listRecords(institutionId: string, resourceType: string, filters: Record<string, string> = {}) {
    const result = await this.query(
      `
        select id, institution_id, resource_type, data, created_at, updated_at
        from institution_resources
        where institution_id = $1
          and resource_type = $2
        order by created_at desc
      `,
      [institutionId, resourceType],
    );
    return result.rows
      .map(mapPostgresResourceRow)
      .filter((record) => Object.entries(filters).every(([key, value]) => record.data[key] === value));
  }

  async getRecord(institutionId: string, resourceType: string, id: string) {
    const result = await this.query(
      `
        select id, institution_id, resource_type, data, created_at, updated_at
        from institution_resources
        where institution_id = $1
          and resource_type = $2
          and id = $3
      `,
      [institutionId, resourceType, id],
    );
    return result.rows[0] ? mapPostgresResourceRow(result.rows[0]) : null;
  }

  async upsertRecord(record: SchoolAdminRecord) {
    const result = await this.query(
      `
        insert into institution_resources (id, institution_id, resource_type, data, updated_at)
        values ($1, $2, $3, $4::jsonb, coalesce($5::timestamptz, now()))
        on conflict (id) do update
          set institution_id = excluded.institution_id,
              resource_type = excluded.resource_type,
              data = excluded.data,
              updated_at = excluded.updated_at
        returning id, institution_id, resource_type, data, created_at, updated_at
      `,
      [record.id, record.institutionId, record.resourceType, record.data, record.updatedAt ?? null],
    );
    return mapPostgresResourceRow(result.rows[0]);
  }

  async deleteRecord(institutionId: string, resourceType: string, id: string) {
    const result = await this.query(
      `
        delete from institution_resources
        where institution_id = $1
          and resource_type = $2
          and id = $3
      `,
      [institutionId, resourceType, id],
    );
    return Boolean(result.rowCount);
  }

  async recordAudit(input: Record<string, unknown>) {
    await this.query(
      `
        insert into audit_events (institution_id, actor_user_id, event_type, metadata)
        values ($1, $2, $3, $4::jsonb)
      `,
      [
        input.institutionId ?? null,
        isUuid(input.actorId) ? input.actorId : null,
        input.action,
        {
          actorId: input.actorId ?? null,
          target: input.target ?? null,
          ...(input.metadata as Record<string, unknown> | undefined),
        },
      ],
    );
    return { recorded: true };
  }

  async queueDelivery(input: Record<string, unknown>) {
    await this.query(
      `
        insert into school_admin_delivery_queue (institution_id, channel, template, recipient, actor_id, payload)
        values ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        input.institutionId,
        input.channel,
        input.template,
        input.recipient,
        input.actorId ?? null,
        input.payload ?? {},
      ],
    );
    return { queued: true, channel: input.channel };
  }

  private async query(text: string, values: unknown[] = []) {
    if (this.queryable) return this.queryable.query(text, values);
    if (!this.pool) {
      const connectionString = process.env.TENANT_REGISTRY_DATABASE_URL;
      if (!connectionString) {
        throw new Error('TENANT_REGISTRY_DATABASE_URL must be configured.');
      }
      const { Pool } = require('pg');
      this.pool = new Pool({ connectionString });
    }
    return this.pool.query(text, values);
  }
}

function mapPostgresResourceRow(row: any): SchoolAdminRecord {
  return {
    id: row.id,
    institutionId: row.institution_id,
    resourceType: row.resource_type,
    data: row.data ?? {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sanitizeObject(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload ?? {}).filter(([, value]) => value !== undefined),
  );
}

function defaultInvitationExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt.toISOString();
}
