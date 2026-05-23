import { rejects } from 'node:assert/strict';
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
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
