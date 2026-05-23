import { deepEqual, equal } from 'node:assert/strict';
import { supabase } from '@campus-one/database/supabase';
import { GradesService } from './grades.service';

type QueryResult = {
  data?: unknown;
  error?: { message: string };
};

function createResult(result: QueryResult) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    upsert: (payload: unknown) => {
      chain.upsertPayload = payload;
      return chain;
    },
    upsertPayload: undefined,
  };
  return chain;
}

async function run() {
  const service = new GradesService() as any;
  const notifications: unknown[] = [];
  let upsertPayload: any;
  const originalSchema = (supabase as any).schema;

  (supabase as any).schema = (schema: string) => {
    equal(schema, 'public');
    return {
      from(table: string) {
        if (table === 'class_enrollments') {
          return createResult({ data: { id: 'enrollment-1' }, error: null });
        }
        if (table === 'grades') {
          const result = createResult({
            data: {
              id: 'grade-1',
              enrollment_id: 'enrollment-1',
              professor_id: 'professor-1',
              final_grade: 91,
              letter_grade: 'A',
              remarks: 'Passed',
              is_locked: true,
            },
            error: null,
          });
          const originalUpsert = result.upsert;
          result.upsert = (payload: unknown) => {
            upsertPayload = payload;
            return originalUpsert(payload);
          };
          return result;
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };
  };
  service.notifications = {
    tryCreate(payload: unknown) {
      notifications.push(payload);
      return Promise.resolve({ success: true });
    },
  };

  try {
    const result = await service.submitProfessorGrade({
      professorId: 'professor-1',
      enrollmentId: 'enrollment-1',
      finalGrade: 91,
      letterGrade: 'A',
      remarks: 'Passed',
    });

    equal(result.status, 'submitted');
    equal(upsertPayload.is_locked, true);
    equal(upsertPayload.enrollment_id, 'enrollment-1');
    equal(upsertPayload.professor_id, 'professor-1');
    equal(typeof upsertPayload.encoded_at, 'string');
    deepEqual(notifications, [
      {
        profileId: 'enrollment-1',
        title: 'Grade submitted',
        body: 'Final grade 91 (A) has been submitted.',
        metadata: {
          action: 'grade.submitted',
          professorId: 'professor-1',
          enrollmentId: 'enrollment-1',
        },
      },
    ]);
  } finally {
    (supabase as any).schema = originalSchema;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
