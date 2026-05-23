import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@campus-one/database/supabase';

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

@Injectable()
export class SchoolAdminService {
  private readonly repository: SchoolAdminRepository;

  constructor(
    @Optional()
    @Inject('SchoolAdminRepository')
    repository?: SchoolAdminRepository,
  ) {
    this.repository = repository ?? new SupabaseSchoolAdminRepository();
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

class SupabaseSchoolAdminRepository implements SchoolAdminRepository {
  async getProfile(institutionId: string) {
    const { data, error } = await supabaseAdmin
      .from('institution_profiles')
      .select('*')
      .eq('id', institutionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async upsertProfile(institutionId: string, payload: Record<string, unknown>) {
    const { data, error } = await supabaseAdmin
      .from('institution_profiles')
      .upsert({ id: institutionId, ...payload }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async listRecords(institutionId: string, resourceType: string, filters: Record<string, string> = {}) {
    const { data, error } = await supabaseAdmin
      .from('institution_resources')
      .select('id, institution_id, resource_type, data, created_at, updated_at')
      .eq('institution_id', institutionId)
      .eq('resource_type', resourceType)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map(mapResourceRow)
      .filter((record) => Object.entries(filters).every(([key, value]) => record.data[key] === value));
  }

  async getRecord(institutionId: string, resourceType: string, id: string) {
    const { data, error } = await supabaseAdmin
      .from('institution_resources')
      .select('id, institution_id, resource_type, data, created_at, updated_at')
      .eq('id', id)
      .eq('institution_id', institutionId)
      .eq('resource_type', resourceType)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapResourceRow(data) : null;
  }

  async upsertRecord(record: SchoolAdminRecord) {
    const { data, error } = await supabaseAdmin
      .from('institution_resources')
      .upsert({
        id: record.id,
        institution_id: record.institutionId,
        resource_type: record.resourceType,
        data: record.data,
        updated_at: record.updatedAt ?? new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('id, institution_id, resource_type, data, created_at, updated_at')
      .single();
    if (error) throw new Error(error.message);
    return mapResourceRow(data);
  }

  async deleteRecord(institutionId: string, resourceType: string, id: string) {
    const { error } = await supabaseAdmin
      .from('institution_resources')
      .delete()
      .eq('id', id)
      .eq('institution_id', institutionId)
      .eq('resource_type', resourceType);
    if (error) throw new Error(error.message);
    return true;
  }

  async recordAudit(input: Record<string, unknown>) {
    const { error } = await supabaseAdmin
      .from('audit_events')
      .insert({
        institution_id: input.institutionId ?? null,
        action: input.action,
        actor_email: input.actorId,
        metadata: {
          target: input.target,
          ...(input.metadata as Record<string, unknown> | undefined),
        },
        created_at: new Date().toISOString(),
      });
    return { recorded: !error, error: error?.message };
  }

  async queueDelivery(input: Record<string, unknown>) {
    const { error } = await supabaseAdmin
      .from('institution_resources')
      .insert({
        id: `delivery-${randomUUID()}`,
        institution_id: input.institutionId,
        resource_type: 'delivery-queue',
        data: input,
      });
    return { queued: !error, error: error?.message, channel: input.channel };
  }
}

function mapResourceRow(row: any): SchoolAdminRecord {
  return {
    id: row.id,
    institutionId: row.institution_id,
    resourceType: row.resource_type,
    data: row.data ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
