import { equal } from 'node:assert/strict';
import { summarizeGrades } from './grades.service';

function run() {
  const summary = summarizeGrades([
    { units: 3, grade: '1.50', remarks: 'Passed' },
    { units: 4, grade: '2.00', remarks: 'Passed' },
    { units: 2, grade: '—', remarks: 'In Progress' },
    { units: 3, grade: '5.00', remarks: 'Failed' },
  ]);

  equal(summary.totalUnits, 12);
  equal(summary.gradedUnits, 10);
  equal(summary.passedUnits, 7);
  equal(summary.failedUnits, 3);
  equal(summary.gwa, '2.75');
  equal(summary.status, 'has_deficiencies');

  const empty = summarizeGrades([]);
  equal(empty.totalUnits, 0);
  equal(empty.gwa, '0.00');
  equal(empty.status, 'no_grades');
}

run();
