import { deepEqual, equal, rejects } from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';

type QueryResult = {
  data?: unknown;
  error?: { message: string };
};

function createResult(result: QueryResult) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    insert: () => chain,
    then: (resolve: (value: QueryResult) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

async function run() {
  const service = new EnrollmentService() as any;
  let classEnrollmentReadCount = 0;
  service.db = {
    from(table: string) {
      if (table === 'class_enrollments') {
        classEnrollmentReadCount += 1;
        if (classEnrollmentReadCount === 1) {
          return createResult({ data: [], error: null });
        }
        return createResult({
          data: [
            { class_assignment_id: 'class-full' },
            { class_assignment_id: 'class-full' },
          ],
          error: null,
        });
      }
      if (table === 'class_assignments') {
        return createResult({
          data: [{ id: 'class-full', max_students: 2, schedule: 'Tue 08:00-10:00' }],
          error: null,
        });
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  await rejects(
    () => service.submit('student-1', ['class-full']),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.getStatus() === 400 &&
      error.message === 'One or more classes are full',
  );

  const successService = new EnrollmentService() as any;
  const eventCalls: unknown[] = [];
  let readCount = 0;
  let insertedRecords: unknown;
  successService.eventPublisher = {
    publish(input: unknown) {
      eventCalls.push(input);
      return Promise.resolve({ envelope: input, published: true });
    },
  };
  successService.db = {
    from(table: string) {
      if (table === 'class_enrollments') {
        readCount += 1;
        if (readCount === 1) return createResult({ data: [], error: null });
        if (readCount === 2) return createResult({ data: [], error: null });
        return {
          insert(records: unknown) {
            insertedRecords = records;
            return createResult({
              data: [{ id: 'enrollment-1', enrollment_status: 'enrolled' }],
              error: null,
            });
          },
        };
      }
      if (table === 'class_assignments') {
        return createResult({
          data: [{ id: 'class-1', max_students: 20, schedule: 'Tue 08:00-10:00' }],
          error: null,
        });
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const submitResult = await successService.submit('student-1', ['class-1'], 'school-a');
  equal(submitResult.status, undefined);
  deepEqual(insertedRecords, [
    {
      student_id: 'student-1',
      class_assignment_id: 'class-1',
      enrollment_status: 'enrolled',
      enrolled_at: (insertedRecords as any[])[0].enrolled_at,
    },
  ]);
  deepEqual(eventCalls, [
    {
      eventType: 'enrollment.submitted',
      tenantId: 'school-a',
      actorId: 'student-1',
      payload: {
        studentId: 'student-1',
        classAssignmentIds: ['class-1'],
        enrollmentCount: 1,
      },
    },
  ]);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
