import { deepEqual, equal } from 'node:assert/strict';

const { NotificationsService } = require('./notifications.service') as typeof import('./notifications.service');

async function main() {
  const previousUrl = process.env.NOTIFICATIONS_AUDIT_DATABASE_URL;
  process.env.NOTIFICATIONS_AUDIT_DATABASE_URL = 'postgresql://user:password@localhost:5432/notifications_audit';

  const calls: any[] = [];
  const service = new NotificationsService();
  (service as any).postgres = {
    async create(payload: unknown) {
      calls.push({ method: 'create', payload });
      return { id: 'notification-1', profile_id: (payload as any).profileId, title: (payload as any).title, is_read: false };
    },
    async list(profileId: string) {
      calls.push({ method: 'list', profileId });
      return [{ id: 'notification-1', profile_id: profileId }];
    },
    async markRead(profileId: string, notificationId: string) {
      calls.push({ method: 'markRead', profileId, notificationId });
      return { id: notificationId, profile_id: profileId, is_read: true };
    },
    async markAllRead(profileId: string) {
      calls.push({ method: 'markAllRead', profileId });
      return { profileId, updated: true };
    },
    async audit(action: string, actor: string, metadata: unknown) {
      calls.push({ method: 'audit', action, actor, metadata });
    },
  };

  const created = await service.create({
    profileId: 'profile-live',
    title: 'Document request submitted',
    metadata: { action: 'alumni.record.requested', tenant_id: 'school-a' },
  });
  equal((created as any).id, 'notification-1');
  equal((await service.tryCreate({ profileId: 'profile-live', title: 'Safe create' }) as any).id, 'notification-1');
  equal((await service.list('profile-live')).length, 1);
  equal((await service.markRead('profile-live', 'notification-1') as any).is_read, true);
  deepEqual(await service.markAllRead('profile-live'), { profileId: 'profile-live', updated: true });
  await service.audit('notification.custom', 'profile-live', { tenant_id: 'school-a' });

  deepEqual(calls.map((call) => call.method), [
    'create',
    'create',
    'list',
    'markRead',
    'markAllRead',
    'audit',
  ]);

  if (previousUrl === undefined) {
    delete process.env.NOTIFICATIONS_AUDIT_DATABASE_URL;
  } else {
    process.env.NOTIFICATIONS_AUDIT_DATABASE_URL = previousUrl;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
