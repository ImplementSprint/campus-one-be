import { deepEqual, equal, ok } from 'node:assert/strict';
import { PostgresAlumniRepository } from './alumni-postgres.repository';
import { DocumentType, PaymentStatus } from './interfaces/alumni.interface';

type QueryCall = { text: string; values?: unknown[] };

class FakeDb {
  readonly calls: QueryCall[] = [];
  readonly registrations = new Map<string, any>();
  readonly accounts = new Map<string, any>();
  readonly records = new Map<string, any>();
  readonly cards = new Map<string, any>();
  readonly events: any[] = [];

  async query(text: string, values: unknown[] = []) {
    this.calls.push({ text, values });
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.includes('insert into alumni_registration_logs')) {
      const row = {
        log_id: values[0],
        institution_id: values[1],
        actor_uuid: values[2],
        action_type: 'alumni.registration.submitted.v1',
        status_code: 100,
        tenant_id: values[1],
        full_name: values[3],
        email: values[4],
        graduation_year: values[5],
        program: values[6],
        academic_unit: values[7],
        is_legacy_registration: values[8],
        student_id: values[9],
        proof_reference: values[10],
        document_url: values[11],
        created_at: '2026-05-25T00:00:00.000Z',
      };
      this.registrations.set(String(row.log_id), row);
      return { rows: [row] };
    }

    if (normalized.includes('insert into alumni_accounts')) {
      const row = {
        institution_id: values[0],
        email: values[1],
        name: values[2],
        student_number: values[3],
        graduation_year: values[4],
        program: values[5],
        academic_unit: values[6],
        phone_number: values[7],
        is_active: true,
      };
      this.accounts.set(`${String(row.institution_id)}:${String(row.email)}`, row);
      return { rows: [row] };
    }

    if (normalized.includes('insert into alumni_record_requests')) {
      const row = {
        log_id: values[0],
        institution_id: values[1],
        actor_uuid: values[2],
        action_type: 'alumni.record.requested.v1',
        status_code: 100,
        tenant_id: values[1],
        document_type: values[3],
        fee_amount: values[4],
        payment_status: PaymentStatus.PENDING,
        notes: values[5],
        delivery_method: values[6],
        number_of_copies: values[7],
        created_at: '2026-05-25T00:00:00.000Z',
      };
      this.records.set(String(row.log_id), row);
      return { rows: [row] };
    }

    if (normalized.includes('update alumni_record_requests')) {
      const row = this.records.get(String(values[2]));
      Object.assign(row, {
        status_code: values[0],
        payment_status: values[1] ?? row.payment_status,
      });
      return { rows: [row] };
    }

    if (normalized.includes('from alumni_record_requests') && normalized.includes('actor_uuid = $')) {
      return { rows: [...this.records.values()].filter((row) => row.actor_uuid === values[0]) };
    }

    if (normalized.includes('from alumni_record_requests') && normalized.includes('institution_id = $1')) {
      return { rows: [...this.records.values()].filter((row) => row.institution_id === values[0]) };
    }

    if (normalized.includes('insert into alumni_activity_events')) {
      const row = {
        institution_id: values[0],
        actor_uuid: values[1],
        event_type: values[2],
        target_id: values[3],
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
  const repository = new PostgresAlumniRepository(db as any);
  const institutionId = '10000000-0000-0000-0000-000000000001';
  const actorUuid = '0e8221b1-1433-4de9-875f-63665313987a';

  const registration = await repository.registerAlumni({
    actor_uuid: actorUuid,
    tenant_id: institutionId,
    first_name: 'Beta',
    middle_name: 'Live',
    last_name: 'Alumnus',
    email: 'alumni.live@example.edu',
    phone: '+639171234567',
    academic_unit: 'College of Computer Studies',
    graduation_year: 2024,
    program: 'BSIT',
    student_id: 'STU-2026-A132694C',
  });
  equal(registration.actor_uuid, actorUuid);
  ok([...db.accounts.values()].some((account) => account.email === 'alumni.live@example.edu'));

  const record = await repository.requestRecord({
    actor_uuid: actorUuid,
    tenant_id: institutionId,
    document_type: DocumentType.DIPLOMA,
    number_of_copies: 2,
    delivery_method: 'pickup',
  }, 400);
  equal(record.fee_amount, 400);
  equal(record.payment_status, PaymentStatus.PENDING);

  const listed = await repository.getAllRecordRequests(institutionId);
  equal(listed.length, 1);

  const fulfilled = await repository.updateRecordStatus(institutionId, record.log_id, 300, PaymentStatus.PAID);
  equal(fulfilled.status_code, 300);
  equal(fulfilled.payment_status, PaymentStatus.PAID);

  const ownRecords = await repository.getRecordRequests(actorUuid);
  equal(ownRecords.length, 1);

  deepEqual(db.events.map((event) => event.event_type), [
    'alumni.registration.submitted',
    'alumni.record.requested',
    'alumni.record.status_updated',
  ]);
  ok(db.calls.some((call) => call.text.includes('alumni_record_requests')));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
