import { BadRequestException, ForbiddenException } from '@nestjs/common';

type QueryResult<T = any> = { rows: T[]; rowCount?: number };
type Queryable = { query<T = any>(text: string, values?: unknown[]): Promise<QueryResult<T>> };

export type EnrollmentInput = {
  institutionId: string;
  studentId: string;
  classAssignmentIds: string[];
};

export type ProfessorGradeInput = {
  institutionId: string;
  professorId: string;
  enrollmentId: string;
  prelimGrade?: number | null;
  midtermGrade?: number | null;
  finalsGrade?: number | null;
  finalGrade?: number | null;
  letterGrade?: string | null;
  remarks?: string | null;
};

export type AcademicAuditListInput = {
  institutionId: string;
  studentId?: string;
  action?: string;
  limit?: number;
};

export class PostgresAcademicsRepository {
  private pool?: Queryable;

  constructor(private readonly queryable?: Queryable) {}

  async listOfferings(input: {
    institutionId: string;
    studentId?: string;
    program?: string;
    yearLevel?: number;
  }) {
    const studentContext = await this.resolveStudentContext(input);
    if (!studentContext.program || !studentContext.yearLevel) return [];

    const result = await this.query(
      `
        select
          ca.id,
          ca.subject_id,
          s.code as subject_code,
          s.name as subject_name,
          s.description as subject_description,
          s.units,
          c.term,
          ca.section,
          ca.schedule,
          ca.room,
          ca.max_students,
          coalesce(ec.enrolled_count, 0) as enrolled_count
        from academic_curriculum c
        join academic_subjects s
          on s.id = c.subject_id
         and s.institution_id = c.institution_id
        left join academic_class_assignments ca
          on ca.subject_id = c.subject_id
         and ca.institution_id = c.institution_id
         and ca.is_active = true
        left join (
          select institution_id, class_assignment_id, count(*) as enrolled_count
          from academic_class_enrollments
          where enrollment_status = 'enrolled'
          group by institution_id, class_assignment_id
        ) ec
          on ec.institution_id = c.institution_id
         and ec.class_assignment_id = ca.id
        where c.institution_id = $1
          and c.program = $2
          and c.year_level = $3
        order by c.term, s.code
      `,
      [input.institutionId, studentContext.program, studentContext.yearLevel],
    );

    return result.rows.map((row) => ({
      id: row.id,
      subject_id: row.subject_id,
      subjectCode: row.subject_code,
      subjectTitle: row.subject_name,
      units: Number(row.units ?? 0),
      description: row.subject_description,
      term: row.term,
      section: row.section ?? 'TBA',
      schedule: row.schedule ?? 'TBA',
      room: row.room ?? 'TBA',
      slotsTotal: Number(row.max_students ?? 0),
      slotsTaken: Number(row.enrolled_count ?? 0),
      isFull: row.id ? Number(row.enrolled_count ?? 0) >= Number(row.max_students ?? 0) : false,
      hasAssignment: Boolean(row.id),
    }));
  }

  async submitEnrollment(input: EnrollmentInput) {
    if (!input.studentId || !input.classAssignmentIds.length) {
      throw new BadRequestException('Missing required fields: studentId and classAssignmentIds');
    }

    const existing = await this.query(
      `
        select class_assignment_id
        from academic_class_enrollments
        where institution_id = $1
          and student_id = $2
          and class_assignment_id = any($3::text[])
          and enrollment_status = 'enrolled'
      `,
      [input.institutionId, input.studentId, input.classAssignmentIds],
    );
    if (existing.rows.length) {
      throw new BadRequestException('Student is already enrolled in one or more of these classes');
    }

    const assignments = await this.query(
      `
        select id, max_students, schedule
        from academic_class_assignments
        where institution_id = $1
          and id = any($2::text[])
          and is_active = true
      `,
      [input.institutionId, input.classAssignmentIds],
    );
    if (assignments.rows.length !== input.classAssignmentIds.length) {
      throw new BadRequestException('One or more selected classes are no longer available');
    }
    if (hasScheduleConflict(assignments.rows)) {
      throw new BadRequestException('Selected classes have a schedule conflict');
    }

    const counts = await this.query(
      `
        select class_assignment_id, count(*) as enrolled_count
        from academic_class_enrollments
        where institution_id = $1
          and class_assignment_id = any($2::text[])
          and enrollment_status = 'enrolled'
        group by class_assignment_id
      `,
      [input.institutionId, input.classAssignmentIds],
    );
    const countMap = new Map(counts.rows.map((row) => [row.class_assignment_id, Number(row.enrolled_count ?? 0)]));
    if (assignments.rows.some((row) => (countMap.get(row.id) ?? 0) >= Number(row.max_students ?? 0))) {
      throw new BadRequestException('One or more classes are full');
    }

    const insertedRows = [];
    for (const classAssignmentId of input.classAssignmentIds) {
      const inserted = await this.query(
        `
          insert into academic_class_enrollments (
            institution_id,
            student_id,
            class_assignment_id,
            enrollment_status,
            enrolled_at
          )
          values ($1, $2, $3, 'enrolled', now())
          returning
            id,
            enrollment_status,
            enrolled_at,
            class_assignment_id,
            (
              select section from academic_class_assignments
              where institution_id = $1 and id = $3
            ) as section,
            (
              select schedule from academic_class_assignments
              where institution_id = $1 and id = $3
            ) as schedule,
            (
              select room from academic_class_assignments
              where institution_id = $1 and id = $3
            ) as room,
            (
              select s.code
              from academic_class_assignments ca
              join academic_subjects s on s.id = ca.subject_id and s.institution_id = ca.institution_id
              where ca.institution_id = $1 and ca.id = $3
            ) as subject_code,
            (
              select s.name
              from academic_class_assignments ca
              join academic_subjects s on s.id = ca.subject_id and s.institution_id = ca.institution_id
              where ca.institution_id = $1 and ca.id = $3
            ) as subject_name,
            (
              select s.units
              from academic_class_assignments ca
              join academic_subjects s on s.id = ca.subject_id and s.institution_id = ca.institution_id
              where ca.institution_id = $1 and ca.id = $3
            ) as units
        `,
        [input.institutionId, input.studentId, classAssignmentId],
      );
      insertedRows.push(...inserted.rows);
    }

    return {
      success: true,
      message: 'Successfully enrolled in classes',
      enrollments: insertedRows,
      count: insertedRows.length,
    };
  }

  async getEnrollmentStatus(institutionId: string, studentId: string) {
    const result = await this.query(
      `
        select
          e.id,
          e.enrollment_status,
          e.enrolled_at,
          e.class_assignment_id,
          ca.section,
          ca.schedule,
          ca.room,
          s.code as subject_code,
          s.name as subject_name,
          s.units
        from academic_class_enrollments e
        join academic_class_assignments ca
          on ca.id = e.class_assignment_id
         and ca.institution_id = e.institution_id
        join academic_subjects s
          on s.id = ca.subject_id
         and s.institution_id = ca.institution_id
        where e.institution_id = $1
          and e.student_id = $2
          and e.enrollment_status = 'enrolled'
        order by e.enrolled_at desc
      `,
      [institutionId, studentId],
    );

    const enrollments = result.rows.map(mapEnrollmentStatusRow);
    return {
      isEnrolled: enrollments.length > 0,
      enrollmentCount: enrollments.length,
      totalUnits: enrollments.reduce((sum, enrollment) => sum + Number(enrollment.subject.units ?? 0), 0),
      enrollments,
    };
  }

  async getDashboardSummary(institutionId: string, studentId: string) {
    const result = await this.query(
      `
        select
          sa.full_name,
          count(e.id) as enrolled_courses,
          coalesce(sum(s.units), 0) as enrolled_units
        from academic_student_accounts sa
        left join academic_class_enrollments e
          on e.student_id = sa.id
         and e.institution_id = sa.institution_id
         and e.enrollment_status = 'enrolled'
        left join academic_class_assignments ca
          on ca.id = e.class_assignment_id
         and ca.institution_id = e.institution_id
        left join academic_subjects s
          on s.id = ca.subject_id
         and s.institution_id = ca.institution_id
        where sa.institution_id = $1
          and sa.id = $2
        group by sa.id, sa.full_name
      `,
      [institutionId, studentId],
    );
    const row = result.rows[0];

    return {
      name: row?.full_name ?? '',
      enrolledCourses: Number(row?.enrolled_courses ?? 0),
      enrolledUnits: Number(row?.enrolled_units ?? 0),
      cartSubjects: 0,
      cartUnits: 0,
    };
  }

  async getRoster(institutionId: string, professorId: string, classId: string) {
    await this.assertClassBelongsToProfessor(institutionId, professorId, classId);

    const result = await this.query(
      `
        select
          e.id,
          e.enrollment_status,
          e.enrolled_at,
          e.student_id,
          sa.email,
          sa.student_number,
          sa.applicant_id,
          sa.full_name
        from academic_class_enrollments e
        join academic_student_accounts sa
          on sa.id = e.student_id
         and sa.institution_id = e.institution_id
        where e.institution_id = $1
          and e.class_assignment_id = $2
          and e.enrollment_status = 'enrolled'
        order by e.enrolled_at
      `,
      [institutionId, classId],
    );

    return {
      professorId,
      classId,
      classAssignmentId: classId,
      students: result.rows.map((row) => ({
        enrollmentId: row.id,
        status: row.enrollment_status,
        enrolledAt: row.enrolled_at,
        student: {
          id: row.student_id,
          email: row.email ?? '',
          studentNumber: row.student_number ?? '',
          name: row.full_name ?? 'Student',
          applicantId: row.applicant_id ?? null,
        },
      })),
    };
  }

  async getProfessorClasses(institutionId: string, professorId: string) {
    const result = await this.query(
      `
        select
          ca.id,
          ca.section,
          ca.schedule,
          ca.room,
          ca.max_students,
          s.id as subject_id,
          s.code as subject_code,
          s.name as subject_name,
          s.description as subject_description,
          s.units,
          coalesce(ec.enrolled_count, 0) as enrolled_count
        from academic_class_assignments ca
        join academic_subjects s
          on s.id = ca.subject_id
         and s.institution_id = ca.institution_id
        left join (
          select institution_id, class_assignment_id, count(*) as enrolled_count
          from academic_class_enrollments
          where enrollment_status = 'enrolled'
          group by institution_id, class_assignment_id
        ) ec
          on ec.institution_id = ca.institution_id
         and ec.class_assignment_id = ca.id
        where ca.institution_id = $1
          and ca.professor_id = $2
          and ca.is_active = true
        order by ca.created_at desc
      `,
      [institutionId, professorId],
    );

    return {
      professorId,
      classes: result.rows.map((row) => ({
        id: row.id,
        subject: {
          id: row.subject_id,
          code: row.subject_code,
          name: row.subject_name,
          description: row.subject_description,
          units: Number(row.units ?? 0),
        },
        section: row.section,
        schedule: row.schedule,
        room: row.room,
        max_students: Number(row.max_students ?? 0),
        enrolled_count: Number(row.enrolled_count ?? 0),
      })),
    };
  }

  async submitProfessorGrade(input: ProfessorGradeInput) {
    const enrollment = await this.assertEnrollmentBelongsToProfessor(input.institutionId, input.professorId, input.enrollmentId);

    const result = await this.query(
      `
        insert into academic_grades (
          institution_id,
          enrollment_id,
          professor_id,
          prelim_grade,
          midterm_grade,
          finals_grade,
          final_grade,
          letter_grade,
          remarks,
          is_locked,
          encoded_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, now(), now())
        on conflict (institution_id, enrollment_id) do update
          set professor_id = excluded.professor_id,
              prelim_grade = excluded.prelim_grade,
              midterm_grade = excluded.midterm_grade,
              finals_grade = excluded.finals_grade,
              final_grade = excluded.final_grade,
              letter_grade = excluded.letter_grade,
              remarks = excluded.remarks,
              is_locked = true,
              encoded_at = now(),
              updated_at = now()
        returning id, enrollment_id, professor_id, final_grade, letter_grade, remarks, is_locked
      `,
      [
        input.institutionId,
        input.enrollmentId,
        input.professorId,
        input.prelimGrade ?? null,
        input.midtermGrade ?? null,
        input.finalsGrade ?? null,
        input.finalGrade ?? null,
        input.letterGrade ?? null,
        input.remarks ?? null,
      ],
    );
    const grade = mapGradeRow(result.rows[0]);

    await this.query(
      `
        insert into academic_enrollment_audit_events (
          institution_id,
          student_id,
          action,
          metadata,
          created_at
        )
        values ($1, $2, $3, $4::jsonb, now())
      `,
      [
        input.institutionId,
        enrollment.student_id,
        'grade.submitted',
        {
          professorId: input.professorId,
          enrollmentId: input.enrollmentId,
          classAssignmentId: enrollment.class_assignment_id,
          gradeId: grade.id,
          finalGrade: grade.final_grade,
          letterGrade: input.letterGrade ?? null,
          remarks: input.remarks ?? null,
        },
      ],
    );

    return {
      success: true,
      status: 'submitted',
      grade,
      notification: {
        type: 'grade_submitted',
        professorId: input.professorId,
        enrollmentId: input.enrollmentId,
        title: 'Grade submitted',
        body: `Final grade ${input.finalGrade} (${input.letterGrade}) has been submitted.`,
      },
    };
  }

  async getGrades(institutionId: string, studentId: string) {
    const result = await this.query(
      `
        select
          sa.full_name as student_name,
          sa.program,
          s.code,
          s.name as title,
          s.units,
          c.term,
          g.final_grade,
          g.letter_grade,
          g.remarks
        from academic_class_enrollments e
        join academic_student_accounts sa
          on sa.id = e.student_id
         and sa.institution_id = e.institution_id
        join academic_class_assignments ca
          on ca.id = e.class_assignment_id
         and ca.institution_id = e.institution_id
        join academic_subjects s
          on s.id = ca.subject_id
         and s.institution_id = ca.institution_id
        left join academic_curriculum c
          on c.subject_id = s.id
         and c.institution_id = s.institution_id
         and c.program = sa.program
         and c.year_level = sa.year_level
        left join academic_grades g
          on g.enrollment_id = e.id
         and g.institution_id = e.institution_id
        where e.institution_id = $1
          and e.student_id = $2
        order by c.term, s.code
      `,
      [institutionId, studentId],
    );

    const grades = result.rows.map((row) => ({
      code: row.code ?? '-',
      subject: row.title ?? '-',
      units: Number(row.units ?? 0),
      grade: row.final_grade != null ? String(row.final_grade) : '-',
      letterGrade: row.letter_grade ?? null,
      remarks: row.remarks ?? '-',
      term: row.term ?? null,
    }));

    return {
      studentName: result.rows[0]?.student_name ?? '',
      program: result.rows[0]?.program ?? '',
      grades,
      totalUnits: grades.reduce((sum, grade) => sum + grade.units, 0),
      gwa: summarizeGrades(grades).gwa,
    };
  }

  async listAuditEvents(input: AcademicAuditListInput) {
    const limit = Math.min(Math.max(Number(input.limit) || 100, 1), 250);
    const result = await this.query(
      `
        select id, institution_id, student_id, action, metadata, created_at
        from academic_enrollment_audit_events
        where institution_id = $1
          and ($2::text is null or student_id = $2)
          and ($3::text is null or action = $3)
        order by created_at desc
        limit $4
      `,
      [input.institutionId, input.studentId ?? null, input.action ?? null, limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      studentId: row.student_id,
      action: row.action,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    }));
  }

  private async resolveStudentContext(input: {
    institutionId: string;
    studentId?: string;
    program?: string;
    yearLevel?: number;
  }) {
    if (input.program && input.yearLevel) {
      return { program: input.program, yearLevel: input.yearLevel };
    }
    if (!input.studentId) return { program: input.program, yearLevel: input.yearLevel };

    const result = await this.query(
      `
        select program, year_level
        from academic_student_accounts
        where institution_id = $1
          and id = $2
      `,
      [input.institutionId, input.studentId],
    );
    const row = result.rows[0];
    return {
      program: input.program ?? row?.program,
      yearLevel: input.yearLevel ?? (row?.year_level == null ? undefined : Number(row.year_level)),
    };
  }

  private async assertClassBelongsToProfessor(institutionId: string, professorId: string, classId: string) {
    const result = await this.query(
      `
        select id
        from academic_class_assignments
        where institution_id = $1
          and professor_id = $2
          and id = $3
      `,
      [institutionId, professorId, classId],
    );
    if (!result.rows[0]) throw new ForbiddenException('Professor is not assigned to this class.');
  }

  private async assertEnrollmentBelongsToProfessor(institutionId: string, professorId: string, enrollmentId: string) {
    const result = await this.query(
      `
        select e.id, e.student_id, e.class_assignment_id
        from academic_class_enrollments e
        join academic_class_assignments ca
          on ca.id = e.class_assignment_id
         and ca.institution_id = e.institution_id
        where e.institution_id = $1
          and ca.professor_id = $2
          and e.id = $3
      `,
      [institutionId, professorId, enrollmentId],
    );
    if (!result.rows[0]) throw new ForbiddenException('Professor is not assigned to this enrollment.');
    return result.rows[0];
  }

  private async query<T = any>(text: string, values?: unknown[]) {
    return this.getQueryable().query<T>(text, values);
  }

  private getQueryable() {
    if (this.queryable) return this.queryable;
    if (!this.pool) {
      const connectionString = process.env.ACADEMICS_DATABASE_URL;
      if (!connectionString?.trim()) {
        throw new Error('ACADEMICS_DATABASE_URL must be configured.');
      }
      const { Pool } = require('pg');
      this.pool = new Pool({ connectionString });
    }
    return this.pool;
  }
}

function mapEnrollmentStatusRow(row: any) {
  return {
    id: row.id,
    status: row.enrollment_status,
    enrolledAt: row.enrolled_at,
    classAssignmentId: row.class_assignment_id,
    subject: {
      code: row.subject_code,
      name: row.subject_name,
      units: Number(row.units ?? 0),
    },
    section: row.section,
    schedule: row.schedule,
    room: row.room,
  };
}

function mapGradeRow(row: any) {
  return {
    ...row,
    final_grade: row?.final_grade == null ? row?.final_grade : Number(row.final_grade),
    is_locked: Boolean(row?.is_locked),
  };
}

function summarizeGrades(grades: Array<{ units: number; grade: string; remarks?: string }>) {
  const numericGrades = grades
    .map((grade) => ({
      units: Number(grade.units ?? 0),
      value: Number.parseFloat(grade.grade),
      remarks: grade.remarks,
    }))
    .filter((grade) => Number.isFinite(grade.value));
  const gradedUnits = numericGrades.reduce((sum, grade) => sum + grade.units, 0);
  const weightedTotal = numericGrades.reduce((sum, grade) => sum + grade.value * grade.units, 0);
  return {
    gwa: gradedUnits ? (weightedTotal / gradedUnits).toFixed(2) : '0.00',
  };
}

function hasScheduleConflict(classes: Array<{ id: string; schedule?: string | null }>) {
  const windows = classes.flatMap((scheduledClass) => parseScheduleWindows(scheduledClass));
  return windows.some((window, index) =>
    windows.slice(index + 1).some((candidate) =>
      window.id !== candidate.id &&
      window.day === candidate.day &&
      window.start < candidate.end &&
      candidate.start < window.end,
    ),
  );
}

function parseScheduleWindows(scheduledClass: { id: string; schedule?: string | null }) {
  const schedule = scheduledClass.schedule?.trim();
  if (!schedule || schedule.toUpperCase() === 'TBA') return [];

  const match = schedule.match(/^(?<days>[A-Za-z/,\s]+)\s+(?<start>\d{1,2}:\d{2})\s*-\s*(?<end>\d{1,2}:\d{2})/);
  if (!match?.groups) return [];

  const start = toMinutes(match.groups.start);
  const end = toMinutes(match.groups.end);
  if (start == null || end == null || start >= end) return [];

  return match.groups.days
    .split(/[\/,\s]+/)
    .map((day) => normalizeDay(day))
    .filter((day): day is string => Boolean(day))
    .map((day) => ({ id: scheduledClass.id, day, start, end }));
}

function normalizeDay(day: string) {
  const normalized = day.trim().toLowerCase();
  const dayMap: Record<string, string> = {
    m: 'mon',
    mon: 'mon',
    monday: 'mon',
    t: 'tue',
    tue: 'tue',
    tues: 'tue',
    tuesday: 'tue',
    w: 'wed',
    wed: 'wed',
    wednesday: 'wed',
    th: 'thu',
    thu: 'thu',
    thur: 'thu',
    thurs: 'thu',
    thursday: 'thu',
    f: 'fri',
    fri: 'fri',
    friday: 'fri',
    sat: 'sat',
    saturday: 'sat',
    sun: 'sun',
    sunday: 'sun',
  };
  return dayMap[normalized];
}

function toMinutes(time: string) {
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return hour * 60 + minute;
}
