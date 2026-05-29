import { deepEqual, equal, rejects } from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
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
  const originalSchema = (supabase as any).schema;

  try {
    const submitService = new GradesService() as any;
    const notifications: unknown[] = [];
    const events: unknown[] = [];
    let submitUpsertPayload: any;

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
              submitUpsertPayload = payload;
              return originalUpsert(payload);
            };
            return result;
          }
          throw new Error(`Unexpected table ${table}`);
        },
      };
    };
    submitService.notifications = {
      tryCreate(payload: unknown) {
        notifications.push(payload);
        return Promise.resolve({ success: true });
      },
    };
    submitService.eventPublisher = {
      publish(input: unknown) {
        events.push(input);
        return Promise.resolve({ envelope: input, published: true });
      },
    };

    const result = await submitService.submitProfessorGrade({
      professorId: 'professor-1',
      enrollmentId: 'enrollment-1',
      finalGrade: 91,
      letterGrade: 'A',
      remarks: 'Passed',
    });

    equal(result.status, 'submitted');
    equal(submitUpsertPayload.is_locked, true);
    equal(submitUpsertPayload.enrollment_id, 'enrollment-1');
    equal(submitUpsertPayload.professor_id, 'professor-1');
    equal(typeof submitUpsertPayload.encoded_at, 'string');
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
    deepEqual(events, [
      {
        eventType: 'grade.submitted',
        tenantId: null,
        actorId: 'professor-1',
        payload: {
          enrollmentId: 'enrollment-1',
          professorId: 'professor-1',
          finalGrade: 91,
          letterGrade: 'A',
        },
      },
    ]);

    const draftService = new GradesService() as any;
    let draftUpsertPayload: any;
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
                id: 'grade-2',
                enrollment_id: 'enrollment-1',
                professor_id: 'professor-1',
                prelim_grade: 88,
                midterm_grade: null,
                finals_grade: null,
                final_grade: null,
                letter_grade: null,
                remarks: null,
                is_locked: false,
              },
              error: null,
            });
            const originalUpsert = result.upsert;
            result.upsert = (payload: unknown) => {
              draftUpsertPayload = payload;
              return originalUpsert(payload);
            };
            return result;
          }
          throw new Error(`Unexpected table ${table}`);
        },
      };
    };

    const draftResult = await draftService.saveProfessorGrade({
      professorId: 'professor-1',
      enrollmentId: 'enrollment-1',
      prelimGrade: 88,
    });

    equal(draftResult.status, 'saved');
    equal(draftUpsertPayload.enrollment_id, 'enrollment-1');
    equal(draftUpsertPayload.professor_id, 'professor-1');
    equal(draftUpsertPayload.prelim_grade, 88);
    equal(Object.prototype.hasOwnProperty.call(draftUpsertPayload, 'is_locked'), false);

    const deniedService = new GradesService();
    let gradesTableWasTouched = false;
    (supabase as any).schema = (schema: string) => {
      equal(schema, 'public');
      return {
        from(table: string) {
          if (table === 'class_enrollments') {
            return createResult({ data: null, error: null });
          }
          if (table === 'grades') {
            gradesTableWasTouched = true;
            return createResult({ data: null, error: null });
          }
          throw new Error(`Unexpected table ${table}`);
        },
      };
    };

    await rejects(
      () => deniedService.submitProfessorGrade({
        professorId: 'professor-2',
        enrollmentId: 'enrollment-1',
        finalGrade: 91,
        letterGrade: 'A',
        remarks: 'Passed',
      }),
      ForbiddenException,
    );
    equal(gradesTableWasTouched, false);
  } finally {
    (supabase as any).schema = originalSchema;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
