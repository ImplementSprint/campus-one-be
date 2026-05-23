import { deepEqual, equal } from 'node:assert/strict';
import {
  findDuplicateClassAssignmentIds,
  hasScheduleConflict,
  isEnrollmentPeriodOpen,
  listMissingPrerequisites,
  validateCurriculumPath,
  validateStudentEligibility,
} from './enrollment.service';

function run() {
  deepEqual(findDuplicateClassAssignmentIds(['class-a', 'class-b', 'class-a']), ['class-a']);
  deepEqual(findDuplicateClassAssignmentIds(['class-a', 'class-b']), []);
  deepEqual(findDuplicateClassAssignmentIds([' class-a ', 'class-a']), ['class-a']);

  equal(
    hasScheduleConflict([
      { id: 'class-a', schedule: 'Mon 08:00-10:00' },
      { id: 'class-b', schedule: 'Mon 09:30-11:00' },
    ]),
    true,
  );
  equal(
    hasScheduleConflict([
      { id: 'class-a', schedule: 'Mon/Wed 08:00-09:00' },
      { id: 'class-b', schedule: 'Wed 08:30-10:00' },
    ]),
    true,
  );
  equal(
    hasScheduleConflict([
      { id: 'class-a', schedule: 'Tue 08:00-10:00' },
      { id: 'class-b', schedule: 'Tue 10:00-11:00' },
      { id: 'class-c', schedule: 'TBA' },
    ]),
    false,
  );

  equal(
    isEnrollmentPeriodOpen({
      status: 'open',
      startsAt: '2026-05-01T00:00:00.000Z',
      endsAt: '2026-05-31T23:59:59.000Z',
    }, new Date('2026-05-23T12:00:00.000Z')),
    true,
  );
  equal(
    isEnrollmentPeriodOpen({
      status: 'closed',
      startsAt: '2026-05-01T00:00:00.000Z',
      endsAt: '2026-05-31T23:59:59.000Z',
    }, new Date('2026-05-23T12:00:00.000Z')),
    false,
  );
  equal(validateStudentEligibility({ enrollmentStatus: 'active', holds: [] }).eligible, true);
  equal(validateStudentEligibility({ enrollmentStatus: 'inactive', holds: [] }).eligible, false);
  equal(validateStudentEligibility({ enrollmentStatus: 'active', holds: [{ id: 'hold-1' }] }).eligible, false);
  deepEqual(listMissingPrerequisites(['subj-1', 'subj-2'], ['subj-1']), ['subj-2']);
  deepEqual(validateCurriculumPath(['subj-1', 'subj-3'], ['subj-1', 'subj-2']), ['subj-3']);
}

run();
