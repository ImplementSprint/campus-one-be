import { deepEqual, equal, ok } from 'node:assert/strict';
import { PostgresAcademicsRepository } from './academics-postgres.repository';

type QueryCall = { text: string; values?: unknown[] };

class FakeAcademicsDb {
  readonly calls: QueryCall[] = [];

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.includes('from academic_curriculum c') && normalized.includes('academic_class_assignments ca')) {
      return {
        rows: [{
          id: 'class-1',
          subject_id: 'subject-1',
          subject_code: 'IT101',
          subject_name: 'Intro to Computing',
          subject_description: 'Computing fundamentals',
          units: 3,
          term: '1st Semester',
          section: 'BSIT-1A',
          schedule: 'Mon 09:00-10:30',
          room: 'R101',
          max_students: 30,
          enrolled_count: '0',
        }],
      };
    }

    if (normalized.includes('from academic_class_assignments') && normalized.includes('where institution_id = $1') && normalized.includes('id = any')) {
      return {
        rows: [{
          id: 'class-1',
          max_students: 30,
          schedule: 'Mon 09:00-10:30',
        }],
      };
    }

    if (normalized.includes('from academic_student_accounts sa') && normalized.includes('enrolled_courses')) {
      return {
        rows: [{
          full_name: 'Demo Student',
          enrolled_courses: '2',
          enrolled_units: '6',
        }],
      };
    }

    if (normalized.includes('from academic_class_enrollments') && normalized.includes('student_id = $2') && !normalized.includes('academic_grades')) {
      return { rows: [] };
    }

    if (normalized.includes('from academic_class_enrollments') && normalized.includes('class_assignment_id = any')) {
      return { rows: [] };
    }

    if (normalized.includes('insert into academic_class_enrollments')) {
      return {
        rows: [{
          id: 'enrollment-1',
          enrollment_status: 'enrolled',
          enrolled_at: '2026-05-25T00:00:00.000Z',
          class_assignment_id: 'class-1',
          section: 'BSIT-1A',
          schedule: 'Mon 09:00-10:30',
          room: 'R101',
          subject_code: 'IT101',
          subject_name: 'Intro to Computing',
          units: 3,
        }],
      };
    }

    if (normalized.includes('from academic_class_assignments') && normalized.includes('professor_id = $2')) {
      return { rows: [{ id: 'class-1' }] };
    }

    if (normalized.includes('from academic_class_enrollments e') && normalized.includes('ca.professor_id = $2')) {
      return { rows: [{ id: 'enrollment-1', student_id: 'student-1', class_assignment_id: 'class-1' }] };
    }

    if (normalized.includes('from academic_class_enrollments e') && normalized.includes('academic_student_accounts') && !normalized.includes('academic_grades')) {
      return {
        rows: [{
          id: 'enrollment-1',
          enrollment_status: 'enrolled',
          enrolled_at: '2026-05-25T00:00:00.000Z',
          student_id: 'student-1',
          email: 'student@demo.itsandbox.site',
          student_number: 'S-001',
          applicant_id: 'applicant-1',
          full_name: 'Demo Student',
        }],
      };
    }

    if (normalized.includes('insert into academic_grades')) {
      return {
        rows: [{
          id: 'grade-1',
          enrollment_id: 'enrollment-1',
          professor_id: 'professor-1',
          final_grade: '91',
          letter_grade: 'A',
          remarks: 'Passed',
          is_locked: true,
        }],
      };
    }

    if (normalized.includes('insert into academic_enrollment_audit_events')) {
      return { rows: [{ id: 'audit-1' }] };
    }

    if (normalized.includes('from academic_enrollment_audit_events')) {
      return {
        rows: [{
          id: 'audit-1',
          institution_id: '10000000-0000-0000-0000-000000000001',
          student_id: 'student-1',
          action: 'grade.submitted',
          metadata: {
            professorId: 'professor-1',
            enrollmentId: 'enrollment-1',
            classAssignmentId: 'class-1',
            gradeId: 'grade-1',
            finalGrade: 91,
            letterGrade: 'A',
            remarks: 'Passed',
          },
          created_at: '2026-05-25T00:00:00.000Z',
        }],
      };
    }

    if (normalized.includes('left join academic_grades g') && normalized.includes('academic_subjects')) {
      return {
        rows: [{
          student_name: 'Demo Student',
          program: 'BSIT',
          code: 'IT101',
          title: 'Intro to Computing',
          units: 3,
          final_grade: '91',
          letter_grade: 'A',
          remarks: 'Passed',
          term: '1st Semester',
        }],
      };
    }

    return { rows: [] };
  }
}

async function main() {
  const db = new FakeAcademicsDb();
  const repository = new PostgresAcademicsRepository(db as any);
  const institutionId = '10000000-0000-0000-0000-000000000001';

  const offerings = await repository.listOfferings({ institutionId, program: 'BSIT', yearLevel: 1 });
  equal(offerings.length, 1);
  equal(offerings[0].subjectCode, 'IT101');
  equal(offerings[0].hasAssignment, true);

  const enrollment = await repository.submitEnrollment({
    institutionId,
    studentId: 'student-1',
    classAssignmentIds: ['class-1'],
  });
  equal(enrollment.success, true);
  equal(enrollment.count, 1);
  equal(enrollment.enrollments[0].id, 'enrollment-1');

  const dashboard = await repository.getDashboardSummary(institutionId, 'student-1');
  equal(dashboard.name, 'Demo Student');
  equal(dashboard.enrolledCourses, 2);
  equal(dashboard.enrolledUnits, 6);

  const roster = await repository.getRoster(institutionId, 'professor-1', 'class-1');
  equal(roster.students.length, 1);
  equal(roster.students[0].student.name, 'Demo Student');

  const submitted = await repository.submitProfessorGrade({
    institutionId,
    professorId: 'professor-1',
    enrollmentId: 'enrollment-1',
    finalGrade: 91,
    letterGrade: 'A',
    remarks: 'Passed',
  });
  equal(submitted.status, 'submitted');
  equal(submitted.grade.is_locked, true);

  const gradeAuditCall = db.calls.find((call) => call.text.includes('insert into academic_enrollment_audit_events'));
  ok(gradeAuditCall);
  equal(gradeAuditCall.values?.[0], institutionId);
  equal(gradeAuditCall.values?.[1], 'student-1');
  equal(gradeAuditCall.values?.[2], 'grade.submitted');
  deepEqual(gradeAuditCall.values?.[3], {
    professorId: 'professor-1',
    enrollmentId: 'enrollment-1',
    classAssignmentId: 'class-1',
    gradeId: 'grade-1',
    finalGrade: 91,
    letterGrade: 'A',
    remarks: 'Passed',
  });

  const auditEvents = await repository.listAuditEvents({
    institutionId,
    studentId: 'student-1',
    action: 'grade.submitted',
    limit: 5,
  });
  equal(auditEvents.length, 1);
  equal(auditEvents[0].action, 'grade.submitted');
  equal(auditEvents[0].metadata.enrollmentId, 'enrollment-1');

  const grades = await repository.getGrades(institutionId, 'student-1');
  equal(grades.studentName, 'Demo Student');
  equal(grades.grades[0].code, 'IT101');
  deepEqual(grades.grades.map((grade) => grade.grade), ['91']);

  ok(db.calls.some((call) => call.text.includes('academic_class_enrollments')));
  ok(db.calls.some((call) => call.text.includes('academic_grades')));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
