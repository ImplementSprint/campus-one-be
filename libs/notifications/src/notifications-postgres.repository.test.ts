import { deepEqual, equal, ok } from 'node:assert/strict';
import { PostgresNotificationsRepository } from './notifications-postgres.repository';

class FakeDb {
  readonly notifications = new Map<string, any>();
  readonly events: any[] = [];

  async query(text: string, values: unknown[] = []) {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.includes('insert into in_app_notifications')) {
      const row = {
        id: values[0],
        profile_id: values[1],
        title: values[2],
        body: values[3],
        is_read: false,
        metadata: values[4],
        created_at: '2026-05-25T00:00:00.000Z',
      };
      this.notifications.set(String(row.id), row);
      return { rows: [row] };
    }

    if (normalized.includes('from in_app_notifications') && normalized.includes('profile_id = $1')) {
      return { rows: [...this.notifications.values()].filter((row) => row.profile_id === values[0]) };
    }

    if (normalized.includes('update in_app_notifications') && normalized.includes('id = $2')) {
      const row = this.notifications.get(String(values[1]));
      row.is_read = true;
      return { rows: [row] };
    }

    if (normalized.includes('update in_app_notifications') && normalized.includes('is_read = false')) {
      for (const row of this.notifications.values()) {
        if (row.profile_id === values[0]) row.is_read = true;
      }
      return { rows: [] };
    }

    if (normalized.includes('insert into notification_audit_events')) {
      const row = {
        id: values[0],
        action: values[1],
        actor: values[2],
        tenant_id: values[3],
        metadata: values[4],
      };
      this.events.push(row);
      return { rows: [row] };
    }

    return { rows: [] };
  }
}

async function main() {
  const db = new FakeDb();
  const repository = new PostgresNotificationsRepository(db as any);
  const profileId = 'student-live-smoke';

  const created = await repository.create({
    profileId,
    title: 'Grade submitted',
    body: 'Your grade is ready.',
    metadata: { action: 'grade.submitted', tenant_id: 'school-a' },
  });
  equal(created.profile_id, profileId);
  equal(created.title, 'Grade submitted');
  equal(created.is_read, false);

  const listed = await repository.list(profileId);
  equal(listed.length, 1);

  const read = await repository.markRead(profileId, created.id);
  equal(read.is_read, true);

  await repository.create({
    profileId,
    title: 'Alumni request updated',
    metadata: { action: 'alumni.record.status_updated', tenant_id: 'school-a' },
  });
  const allRead = await repository.markAllRead(profileId);
  deepEqual(allRead, { profileId, updated: true });
  ok((await repository.list(profileId)).every((notification) => notification.is_read));

  await repository.audit('notification.test', profileId, { tenant_id: 'school-a', source: 'unit' });
  deepEqual(db.events.map((event) => event.action), [
    'grade.submitted',
    'notification.read',
    'alumni.record.status_updated',
    'notification.read_all',
    'notification.test',
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
