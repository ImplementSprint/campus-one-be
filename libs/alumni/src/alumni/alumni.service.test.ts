import 'reflect-metadata';
import { equal, deepEqual, rejects, ok } from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';

import { DocumentType, PaymentStatus } from './interfaces/alumni.interface';

type QueryResult = { data?: unknown; error?: { message: string } | null };

const calls: Array<{
  table: string;
  operation: string;
  payload?: unknown;
  filters?: Array<[string, unknown]>;
  order?: unknown;
}> = [];

const tableResults = new Map<string, QueryResult[]>();

function queueResult(table: string, result: QueryResult) {
  const queue = tableResults.get(table) ?? [];
  queue.push(result);
  tableResults.set(table, queue);
}

function nextResult(table: string): QueryResult {
  const queue = tableResults.get(table) ?? [];
  if (queue.length > 0) return queue.shift()!;
  return { data: null, error: null };
}

function makeBuilder(table: string) {
  const call = {
    table,
    operation: '',
    payload: undefined as unknown,
    filters: [] as Array<[string, unknown]>,
    order: undefined as unknown,
  };

  const builder: any = {
    insert(payload: unknown) {
      call.operation = 'insert';
      call.payload = payload;
      calls.push(call);
      return builder;
    },
    upsert(payload: unknown) {
      call.operation = 'upsert';
      call.payload = payload;
      calls.push(call);
      return builder;
    },
    update(payload: unknown) {
      call.operation = 'update';
      call.payload = payload;
      calls.push(call);
      return builder;
    },
    select() {
      if (!call.operation) {
        call.operation = 'select';
        calls.push(call);
      }
      return builder;
    },
    eq(field: string, value: unknown) {
      call.filters.push([field, value]);
      return builder;
    },
    order(field: string, options: unknown) {
      call.order = { field, options };
      return builder;
    },
    limit() {
      return builder;
    },
    single() {
      return Promise.resolve(nextResult(table));
    },
    then(resolve: (value: QueryResult) => unknown, reject: (reason?: unknown) => unknown) {
      return Promise.resolve(nextResult(table)).then(resolve, reject);
    },
  };

  return builder;
}

const fakeSupabase = {
  schema() {
    return {
      from(table: string) {
        return makeBuilder(table);
      },
    };
  },
};

const supabaseConfig = require('./config/supabase.config');
supabaseConfig.getSupabaseClient = () => fakeSupabase;

const { AlumniService } = require('./alumni.service') as typeof import('./alumni.service');

function reset() {
  calls.length = 0;
  tableResults.clear();
}

function baseRegistration(overrides: Record<string, unknown> = {}) {
  return {
    actor_uuid: '0e8221b1-1433-4de9-875f-63665313987a',
    tenant_id: 'school-a',
    first_name: 'Maria',
    middle_name: 'Clara',
    last_name: 'Santos',
    email: 'maria@example.test',
    phone: '09171234567',
    academic_unit: 'College of Business',
    graduation_year: 2024,
    program: 'BS Business Administration',
    student_id: '2020-12345',
    is_legacy_registration: false,
    ...overrides,
  };
}

async function run() {
  const service = new AlumniService();
  (service as any).notifications = { tryCreate: async () => null };
  (service as any).audit = { record: async () => ({ recorded: true }) };

  reset();
  queueResult('alumni_reg_activity_logs', { data: { log_id: 'reg-log-1', actor_uuid: 'actor-1' }, error: null });
  await service.registerAlumni(baseRegistration());
  const registrationInsert = calls.find((call) => call.table === 'alumni_reg_activity_logs' && call.operation === 'insert');
  ok(registrationInsert);
  equal((registrationInsert.payload as any).tenant_id, 'school-a');
  equal((registrationInsert.payload as any).is_legacy_registration, false);
  equal((registrationInsert.payload as any).student_id, '2020-12345');

  await rejects(
    () => service.registerAlumni(baseRegistration({ student_id: '', is_legacy_registration: false })),
    (error: unknown) => error instanceof BadRequestException && error.message === 'Student ID is required for alumni student-record verification',
  );

  await rejects(
    () => service.registerAlumni(baseRegistration({ student_id: undefined, is_legacy_registration: true, proof_reference: undefined, document_url: undefined })),
    (error: unknown) => error instanceof BadRequestException && error.message === 'Proof reference or document URL is required for legacy alumni verification',
  );

  reset();
  queueResult('alumni_reg_activity_logs', { data: { log_id: 'legacy-log-1', actor_uuid: 'actor-legacy' }, error: null });
  await service.registerAlumni(baseRegistration({
    student_id: undefined,
    is_legacy_registration: true,
    proof_reference: 'MANUAL-ALUMNI-090',
  }));
  const legacyInsert = calls.find((call) => call.table === 'alumni_reg_activity_logs' && call.operation === 'insert');
  equal((legacyInsert?.payload as any).is_legacy_registration, true);
  equal((legacyInsert?.payload as any).proof_reference, 'MANUAL-ALUMNI-090');

  deepEqual(service.calculateRecordFee(DocumentType.TOR, 2), {
    document_type: DocumentType.TOR,
    number_of_copies: 2,
    unit_amount: 150,
    total_amount: 300,
    currency: 'PHP',
    payment_mode: 'manual',
  });

  await rejects(
    async () => service.calculateRecordFee(DocumentType.DIPLOMA, 0),
    (error: unknown) => error instanceof BadRequestException && error.message === 'Number of copies must be at least 1',
  );

  reset();
  queueResult('alumni_record_requests', { data: { log_id: 'request-log-1', actor_uuid: 'actor-1', tenant_id: 'school-a' }, error: null });
  await service.requestRecord({
    actor_uuid: 'actor-1',
    tenant_id: 'school-a',
    document_type: DocumentType.DIPLOMA,
    number_of_copies: 3,
    delivery_method: 'pickup',
  });
  const requestInsert = calls.find((call) => call.table === 'alumni_record_requests' && call.operation === 'insert');
  equal((requestInsert?.payload as any).fee_amount, 600);
  equal((requestInsert?.payload as any).payment_status, PaymentStatus.PENDING);

  await rejects(
    () => service.applyForCard({
      actor_uuid: 'actor-1',
      tenant_id: 'school-a',
      application_type: 'new',
      delivery_method: 'pickup',
    }),
    (error: unknown) => error instanceof BadRequestException && error.message === 'ID photo URL is required for alumni card applications',
  );

  reset();
  queueResult('card_applications', { data: { log_id: 'card-log-1', actor_uuid: 'actor-1', tenant_id: 'school-a' }, error: null });
  await service.applyForCard({
    actor_uuid: 'actor-1',
    tenant_id: 'school-a',
    application_type: 'replacement',
    delivery_method: 'delivery',
    id_photo_url: 'https://files.example.test/photo.jpg',
  });
  const cardInsert = calls.find((call) => call.table === 'card_applications' && call.operation === 'insert');
  equal((cardInsert?.payload as any).id_photo_url, 'https://files.example.test/photo.jpg');

  reset();
  const auditCalls: unknown[] = [];
  (service as any).audit = { record: async (input: unknown) => { auditCalls.push(input); return { recorded: true }; } };
  queueResult('alumni_record_requests', {
    data: { log_id: 'request-log-1', actor_uuid: 'actor-1', tenant_id: 'school-a', status_code: 300, payment_status: 'paid' },
    error: null,
  });
  await service.updateRecordStatus('request-log-1', 300, 'paid');
  equal((auditCalls[0] as any).action, 'alumni.record.status_updated');

  reset();
  queueResult('alumni_reg_activity_logs', { data: [{ action_type: 'alumni.registration.submitted.v1' }], error: null });
  queueResult('alumni_record_requests', { data: [{ action_type: 'alumni.record.requested.v1' }], error: null });
  queueResult('card_applications', { data: [{ action_type: 'card_application' }], error: null });
  const communicationLog = await service.getCommunicationLog('actor-1');
  deepEqual(communicationLog.map((item: any) => item.source), ['registration', 'record_request', 'card_application']);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
