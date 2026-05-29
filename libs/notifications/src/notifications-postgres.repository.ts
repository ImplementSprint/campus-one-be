import { randomUUID } from 'node:crypto';
import type { NotificationPayload } from './notifications.service';

type QueryResult<T = any> = { rows: T[]; rowCount?: number };
type Queryable = { query<T = any>(text: string, values?: unknown[]): Promise<QueryResult<T>> };

export class PostgresNotificationsRepository {
  private pool?: Queryable;

  constructor(private readonly queryable?: Queryable) {}

  async create(payload: NotificationPayload) {
    const id = randomUUID();
    const result = await this.query(
      `
        insert into in_app_notifications (
          id,
          profile_id,
          title,
          body,
          metadata,
          is_read,
          created_at
        )
        values ($1, $2, $3, $4, $5::jsonb, false, now())
        returning id, profile_id, title, body, is_read, created_at
      `,
      [
        id,
        payload.profileId,
        payload.title,
        payload.body ?? null,
        payload.metadata ?? {},
      ],
    );
    await this.audit(this.getAuditAction(payload), payload.profileId, payload.metadata ?? { title: payload.title });
    return result.rows[0] ?? {
      id,
      profile_id: payload.profileId,
      title: payload.title,
      body: payload.body ?? null,
      is_read: false,
      created_at: new Date(),
    };
  }

  async list(profileId: string) {
    const result = await this.query(
      `
        select id, profile_id, title, body, is_read, created_at
        from in_app_notifications
        where profile_id = $1
        order by created_at desc
        limit 50
      `,
      [profileId],
    );
    return result.rows;
  }

  async markRead(profileId: string, notificationId: string) {
    const result = await this.query(
      `
        update in_app_notifications
        set is_read = true,
            read_at = now()
        where profile_id = $1
          and id = $2
        returning id, profile_id, title, body, is_read, created_at
      `,
      [profileId, notificationId],
    );
    await this.audit('notification.read', profileId, { notificationId });
    return result.rows[0] ?? {
      id: notificationId,
      profile_id: profileId,
      is_read: true,
    };
  }

  async markAllRead(profileId: string) {
    await this.query(
      `
        update in_app_notifications
        set is_read = true,
            read_at = now()
        where profile_id = $1
          and is_read = false
      `,
      [profileId],
    );
    await this.audit('notification.read_all', profileId, {});
    return { profileId, updated: true };
  }

  async audit(action: string, actor: string, metadata: Record<string, unknown>) {
    await this.query(
      `
        insert into notification_audit_events (
          id,
          action,
          actor,
          tenant_id,
          metadata,
          created_at
        )
        values ($1, $2, $3, $4, $5::jsonb, now())
      `,
      [
        randomUUID(),
        action,
        actor,
        (metadata.tenant_id as string | undefined) ?? null,
        metadata,
      ],
    );
  }

  private getAuditAction(payload: NotificationPayload) {
    return typeof payload.metadata?.action === 'string'
      ? payload.metadata.action
      : 'notification.created';
  }

  private async query<T = any>(text: string, values?: unknown[]) {
    return this.getQueryable().query<T>(text, values);
  }

  private getQueryable() {
    if (this.queryable) return this.queryable;
    if (!this.pool) {
      const connectionString = process.env.NOTIFICATIONS_AUDIT_DATABASE_URL;
      if (!connectionString?.trim()) throw new Error('NOTIFICATIONS_AUDIT_DATABASE_URL must be configured.');
      const { Pool } = require('pg');
      this.pool = new Pool({ connectionString });
    }
    return this.pool;
  }
}
