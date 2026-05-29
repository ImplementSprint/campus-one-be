import { Injectable, Logger } from '@nestjs/common';
import { supabase } from '@campus-one/database/supabase';
import { AuditService } from '../../audit/src/audit.service';
import { redactLogError } from '../../observability/src/log-redaction';
import { PostgresNotificationsRepository } from './notifications-postgres.repository';

export type NotificationPayload = {
  profileId: string;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly db = supabase.schema('public');
  private readonly auditService = new AuditService();
  private readonly postgres = new PostgresNotificationsRepository();

  async create(payload: NotificationPayload) {
    if (this.usePostgres()) {
      return this.postgres.create(payload);
    }

    const { data, error } = await this.db
      .from('notifications')
      .insert({
        profile_id: payload.profileId,
        title: payload.title,
        body: payload.body ?? null,
        is_read: false,
      })
      .select('id, profile_id, title, body, is_read, created_at')
      .single();

    if (error) throw new Error(error.message);
    await this.tryAudit(this.getAuditAction(payload), payload.profileId, payload.metadata ?? { title: payload.title });
    return data;
  }

  async tryCreate(payload: NotificationPayload) {
    try {
      return await this.create(payload);
    } catch (error: any) {
      this.logger.warn(`notification create skipped: ${redactLogError(error)}`);
      await this.tryAudit(this.getAuditAction(payload), payload.profileId, {
        ...(payload.metadata ?? {}),
        notificationSkipped: true,
        notificationTitle: payload.title,
      });
      return null;
    }
  }

  async list(profileId: string) {
    if (this.usePostgres()) {
      return this.postgres.list(profileId);
    }

    const { data, error } = await this.db
      .from('notifications')
      .select('id, profile_id, title, body, is_read, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async markRead(profileId: string, notificationId: string) {
    if (this.usePostgres()) {
      return this.postgres.markRead(profileId, notificationId);
    }

    const { data, error } = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('profile_id', profileId)
      .select('id, profile_id, title, body, is_read, created_at')
      .single();

    if (error) throw new Error(error.message);
    await this.tryAudit('notification.read', profileId, { notificationId });
    return data;
  }

  async markAllRead(profileId: string) {
    if (this.usePostgres()) {
      return this.postgres.markAllRead(profileId);
    }

    const { error } = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('profile_id', profileId)
      .eq('is_read', false);

    if (error) throw new Error(error.message);
    await this.tryAudit('notification.read_all', profileId, {});
    return { profileId, updated: true };
  }

  async audit(action: string, actor: string, metadata: Record<string, unknown>) {
    if (this.usePostgres()) {
      await this.postgres.audit(action, actor, metadata);
      return;
    }

    await this.auditService.record({
      action,
      actor,
      tenantId: (metadata.tenant_id as string | undefined) ?? null,
      metadata,
    });
  }

  private getAuditAction(payload: NotificationPayload) {
    return typeof payload.metadata?.action === 'string'
      ? payload.metadata.action
      : 'notification.created';
  }

  private usePostgres() {
    return Boolean(process.env.NOTIFICATIONS_AUDIT_DATABASE_URL?.trim());
  }

  private async tryAudit(action: string, actor: string, metadata: Record<string, unknown>) {
    try {
      await this.audit(action, actor, metadata);
    } catch (error) {
      this.logger.warn(`notification audit skipped: ${redactLogError(error)}`);
    }
  }
}
