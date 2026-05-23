import { deepEqual, equal } from 'node:assert/strict';
import { ApplicationService } from './application.service';

type QueryRecord = {
  table: string;
  action: string;
  payload?: unknown;
  filters: Array<{ op: string; column: string; value: unknown }>;
};

class FakeQuery {
  filters: Array<{ op: string; column: string; value: unknown }> = [];
  private selected = false;

  constructor(
    private readonly store: FakeApplicantStore,
    private readonly record: QueryRecord,
  ) {}

  select() {
    this.selected = true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: 'eq', column, value });
    this.record.filters.push({ op: 'eq', column, value });
    return this;
  }

  not(column: string, op: string, value: unknown) {
    this.filters.push({ op: `not.${op}`, column, value });
    this.record.filters.push({ op: `not.${op}`, column, value });
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  single() {
    return this.resolveOne();
  }

  maybeSingle() {
    return this.resolveOne();
  }

  then(resolve: (value: any) => void, reject?: (reason?: unknown) => void) {
    return Promise.resolve(this.record.action === 'select' || this.selected ? this.resolveOne() : { error: null })
      .then(resolve, reject);
  }

  private resolveOne() {
    return { data: this.store.resolve(this.record, this.filters), error: null };
  }
}

class FakeApplicantStore {
  readonly records: QueryRecord[] = [];
  readonly rows: Record<string, any> = {
    applicant_profiles: {
      id: 'app-123',
      email: 'ana@example.edu',
      full_name: 'Ana Reyes',
      reference_number: 'APP-2026-0001',
      applicant_number: 'STU-2026-0001',
      status: 'Accepted',
      school_level: 'College',
      applicant_type: 'New Student',
      program: 'BS Information Technology',
    },
    student_accounts: {
      id: 'student-123',
      applicant_id: 'app-123',
      student_number: 'STU-2026-0001',
      email: 'ana@example.edu',
      enrollment_status: 'active',
    },
  };

  from(table: string) {
    return {
      insert: (payload: unknown) => this.query(table, 'insert', payload),
      update: (payload: unknown) => this.query(table, 'update', payload),
      upsert: (payload: unknown) => this.query(table, 'upsert', payload),
      select: () => this.query(table, 'select'),
      delete: () => this.query(table, 'delete'),
    };
  }

  rpc(name: string) {
    this.records.push({ table: `rpc:${name}`, action: 'call', filters: [] });
    return { data: 'STU-2026-0001', error: null };
  }

  resolve(record: QueryRecord, filters: QueryRecord['filters']) {
    if (
      record.table === 'applicant_profiles' &&
      record.action === 'select' &&
      filters.some((filter) => filter.op === 'not.is' && filter.column === 'application_submitted_at')
    ) {
      return [
        { status: 'Under Review' },
        { status: 'Passed' },
        { status: 'Not Accepted' },
        { status: 'Under Review' },
      ];
    }
    if (record.table === 'applicant_profiles') return this.rows.applicant_profiles;
    if (record.table === 'student_accounts') return this.rows.student_accounts;
    return { id: `${record.table}-row`, filters };
  }

  private query(table: string, action: string, payload?: unknown) {
    const record: QueryRecord = { table, action, payload, filters: [] };
    this.records.push(record);
    return new FakeQuery(this, record);
  }
}

function createService() {
  const service = new ApplicationService() as any;
  const store = new FakeApplicantStore();
  service.db = store;
  service.studentDb = store;
  return { service: service as ApplicationService, store };
}

async function run() {
  const { service, store } = createService();

  const passedResult = await service.updateAdminApplicationStatus('application-1', 'Passed');
  deepEqual(passedResult, { data: { success: true }, error: null });

  const rejectedResult = await service.updateAdminApplicationStatus(
    'application-2',
    'Not Accepted',
    'Incomplete requirements',
  );
  deepEqual(rejectedResult, { data: { success: true }, error: null });

  const stats = await service.fetchAdminDashboardStats();
  deepEqual(stats, {
    data: {
      total: 4,
      pending: 2,
      accepted: 1,
      rejected: 1,
    },
    error: null,
  });

  await service.verifyApplicantDocument('app-123', 'doc-123', 'approved', {
    actorEmail: 'admissions@example.edu',
    remarks: 'Valid transcript',
  });

  await service.recordMissingRequirements('app-123', ['Birth certificate', 'Transcript'], {
    actorEmail: 'admissions@example.edu',
    remarks: 'Transcript is incomplete',
  });

  await service.scheduleEntranceExam('app-123', {
    examDate: '2026-06-01',
    examTime: '09:00',
    examVenue: 'Testing Center A',
    permitNumber: 'PERMIT-123',
    actorEmail: 'admissions@example.edu',
  });

  await service.scheduleInterview('app-123', {
    interviewDate: '2026-06-05',
    interviewTime: '14:00',
    interviewVenue: 'Admissions Office',
    actorEmail: 'admissions@example.edu',
  });

  await service.updateAdminApplicationStatus('app-123', 'Accepted', {
    actorEmail: 'admissions@example.edu',
    acceptanceLetterUrl: 'https://example.edu/noa/app-123.pdf',
  });

  const conversion = await service.convertAcceptedApplicantToStudent('app-123', {
    actorEmail: 'admissions@example.edu',
  });

  equal(conversion.error, null);
  equal(conversion.data?.student_number, 'STU-2026-0001');

  const documentUpdate = store.records.find((record) => record.table === 'applicant_documents' && record.action === 'update');
  deepEqual(documentUpdate?.payload, {
    status: 'approved',
    reviewed_at: documentUpdate?.payload && (documentUpdate.payload as any).reviewed_at,
    reviewed_by: 'admissions@example.edu',
    rejection_reason: null,
  });

  const statusUpdates = store.records
    .filter((record) => record.table === 'applicant_profiles' && record.action === 'update')
    .map((record) => record.payload as Record<string, unknown>);

  equal(statusUpdates.some((payload) => payload.status === 'Missing Requirements'), true);
  equal(statusUpdates.some((payload) => payload.status === 'For Exam'), true);
  equal(statusUpdates.some((payload) => payload.status === 'For Interview'), true);
  equal(statusUpdates.some((payload) => payload.status === 'Accepted'), true);
  equal(statusUpdates.some((payload) => payload.is_enrolled === true), true);

  const studentInsert = store.records.find((record) => record.table === 'student_accounts' && record.action === 'insert');
  deepEqual(studentInsert?.payload, {
    applicant_id: 'app-123',
    student_number: 'STU-2026-0001',
    email: 'ana@example.edu',
    password_hash: 'pending-password-setup',
    enrollment_status: 'active',
    is_active: true,
  });

  const auditEvents = store.records.filter((record) => record.table === 'admissions_activity_logs');
  const auditTypes = auditEvents.map((record) => (record.payload as any).event_type);
  deepEqual(auditTypes, [
    'status_changed',
    'status_changed',
    'document_reviewed',
    'missing_requirements_recorded',
    'entrance_exam_scheduled',
    'interview_scheduled',
    'status_changed',
    'applicant_converted_to_student',
  ]);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
