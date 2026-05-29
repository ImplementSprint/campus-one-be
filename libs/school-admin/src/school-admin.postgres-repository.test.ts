import { deepEqual, equal, ok } from 'node:assert/strict';
import { PostgresSchoolAdminRepository } from './school-admin.service';

type QueryCall = { text: string; values: unknown[] };

class FakeDb {
  readonly calls: QueryCall[] = [];
  private profile: Record<string, unknown> | null = null;
  private records = new Map<string, any>();

  async query(text: string, values: unknown[] = []) {
    this.calls.push({ text, values });
    if (text.includes('from school_admin_profiles')) {
      return { rows: this.profile ? [{ data: this.profile }] : [] };
    }
    if (text.includes('insert into school_admin_profiles')) {
      this.profile = values[1] as Record<string, unknown>;
      return { rows: [{ data: this.profile }] };
    }
    if (text.includes('delete from institution_resources')) {
      const deleted = this.records.delete(values[2] as string);
      return { rowCount: deleted ? 1 : 0, rows: [] };
    }
    if (text.includes('from institution_resources') && text.includes('where id = $3')) {
      const record = this.records.get(String(values[2]));
      return { rows: record ? [record] : [] };
    }
    if (text.includes('from institution_resources') && text.includes('resource_type = $2')) {
      return {
        rows: Array.from(this.records.values()).filter((record) => (
          record.institution_id === values[0] && record.resource_type === values[1]
        )),
      };
    }
    if (text.includes('insert into institution_resources')) {
      const record = {
        id: String(values[0]),
        institution_id: String(values[1]),
        resource_type: String(values[2]),
        data: values[3],
        created_at: new Date('2026-05-25T00:00:00.000Z'),
        updated_at: new Date('2026-05-25T00:00:00.000Z'),
      };
      this.records.set(record.id, record);
      return { rows: [record] };
    }
    if (text.includes('insert into audit_events')) {
      return { rows: [{ recorded: true }] };
    }
    if (text.includes('insert into school_admin_delivery_queue')) {
      return { rows: [{ queued: true, channel: values[1] }] };
    }
    throw new Error(`Unexpected query: ${text}`);
  }
}

async function main() {
  const db = new FakeDb();
  const repository = new PostgresSchoolAdminRepository(db);

  equal(await repository.getProfile('10000000-0000-0000-0000-000000000001'), null);

  const profile = await repository.upsertProfile('10000000-0000-0000-0000-000000000001', {
    name: 'Demo School',
    theme: { primaryColor: '#1946b8' },
  });
  deepEqual(profile, { id: '10000000-0000-0000-0000-000000000001', name: 'Demo School', theme: { primaryColor: '#1946b8' } });

  const record = await repository.upsertRecord({
    id: 'subjects-1',
    institutionId: '10000000-0000-0000-0000-000000000001',
    resourceType: 'subjects',
    data: { code: 'IT101', units: 3 },
  });
  equal(record.id, 'subjects-1');
  equal(record.institutionId, '10000000-0000-0000-0000-000000000001');
  deepEqual(record.data, { code: 'IT101', units: 3 });

  const listed = await repository.listRecords('10000000-0000-0000-0000-000000000001', 'subjects', { code: 'IT101' });
  equal(listed.length, 1);
  equal((await repository.getRecord('10000000-0000-0000-0000-000000000001', 'subjects', 'subjects-1'))?.id, 'subjects-1');
  equal(await repository.deleteRecord('10000000-0000-0000-0000-000000000001', 'subjects', 'subjects-1'), true);

  await repository.recordAudit({
    institutionId: '10000000-0000-0000-0000-000000000001',
    actorId: 'owner-1',
    action: 'school_admin.profile.updated',
    target: 'profile',
    metadata: { changedFields: ['name'] },
  });
  await repository.queueDelivery({
    institutionId: '10000000-0000-0000-0000-000000000001',
    channel: 'email',
    template: 'school_user_invitation',
    recipient: 'professor@demo.test',
    actorId: 'owner-1',
    payload: { role: 'professor' },
  });

  ok(db.calls.some((call) => call.text.includes('school_admin_profiles')));
  ok(db.calls.some((call) => call.text.includes('institution_resources')));
  ok(db.calls.some((call) => call.text.includes('audit_events')));
  ok(db.calls.some((call) => call.text.includes('school_admin_delivery_queue')));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
