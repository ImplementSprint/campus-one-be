import { ForbiddenException, Injectable } from '@nestjs/common';
import { supabase } from '@campus-one/database/supabase';
import { NotificationsService } from '../../../notifications/src/notifications.service';
import { domainEventPublisher, tryPublishDomainEvent } from '../../../events/src/domain-events';
import { PostgresAcademicsRepository } from '../academics-postgres.repository';

@Injectable()
export class GradesService {
  private readonly notifications = new NotificationsService();
  private readonly postgres = new PostgresAcademicsRepository();
  private readonly eventPublisher = domainEventPublisher;

  async getProfessorGradebook(professorId: string, classAssignmentId: string, institutionId?: string) {
    if (this.usePostgres(institutionId)) {
      return this.postgres.getRoster(institutionId!, professorId, classAssignmentId);
    }

    const db = supabase.schema('public');
    const { data, error } = await db.from('class_enrollments')
      .select(`
        id,
        student_id,
        class_assignments!inner(professor_id),
        student_accounts!inner(id, student_number, applicant_id),
        grades(prelim_grade, midterm_grade, finals_grade, final_grade, letter_grade, remarks, is_locked)
      `)
      .eq('class_assignment_id', classAssignmentId)
      .eq('class_assignments.professor_id', professorId)
      .eq('enrollment_status', 'enrolled')
      .order('enrolled_at');
    if (error) throw new Error(error.message);

    return {
      professorId,
      classAssignmentId,
      students: (data || []).map((row: any) => ({
        enrollmentId: row.id,
        studentId: row.student_id,
        studentNumber: row.student_accounts?.student_number ?? null,
        applicantId: row.student_accounts?.applicant_id ?? null,
        grade: Array.isArray(row.grades) ? row.grades[0] ?? null : row.grades ?? null,
      })),
    };
  }

  async saveProfessorGrade(payload: any) {
    await this.assertEnrollmentBelongsToProfessor(payload.professorId, payload.enrollmentId);

    const db = supabase.schema('public');
    const { data, error } = await db.from('grades')
      .upsert(toGradeRow(payload), { onConflict: 'enrollment_id' })
      .select('id, enrollment_id, professor_id, prelim_grade, midterm_grade, finals_grade, final_grade, letter_grade, remarks, is_locked')
      .single();
    if (error) throw new Error(error.message);

    return { success: true, status: 'saved', grade: data };
  }

  async submitProfessorGrade(payload: any, institutionId?: string) {
    if (this.usePostgres(institutionId)) {
      const result = await this.postgres.submitProfessorGrade({
        institutionId: institutionId!,
        professorId: payload.professorId,
        enrollmentId: payload.enrollmentId,
        prelimGrade: payload.prelimGrade,
        midtermGrade: payload.midtermGrade,
        finalsGrade: payload.finalsGrade,
        finalGrade: payload.finalGrade,
        letterGrade: payload.letterGrade,
        remarks: payload.remarks,
      });
      await this.publishGradeSubmittedEvent(payload, institutionId!);
      return result;
    }

    await this.assertEnrollmentBelongsToProfessor(payload.professorId, payload.enrollmentId);

    const db = supabase.schema('public');
    const { data, error } = await db.from('grades')
      .upsert({
        ...toGradeRow(payload),
        is_locked: true,
        encoded_at: new Date().toISOString(),
      }, { onConflict: 'enrollment_id' })
      .select('id, enrollment_id, professor_id, final_grade, letter_grade, remarks, is_locked')
      .single();
    if (error) throw new Error(error.message);

    await this.notifications.tryCreate({
      profileId: payload.enrollmentId,
      title: 'Grade submitted',
      body: `Final grade ${payload.finalGrade} (${payload.letterGrade}) has been submitted.`,
      metadata: {
        action: 'grade.submitted',
        professorId: payload.professorId,
        enrollmentId: payload.enrollmentId,
      },
    });
    await this.publishGradeSubmittedEvent(payload, institutionId ?? null);

    return {
      success: true,
      status: 'submitted',
      grade: data,
      notification: {
        type: 'grade_submitted',
        professorId: payload.professorId,
        enrollmentId: payload.enrollmentId,
        title: 'Grade submitted',
        body: `Final grade ${payload.finalGrade} (${payload.letterGrade}) has been submitted.`,
      },
    };
  }

  async getGrades(userId: string, institutionId?: string) {
    if (this.usePostgres(institutionId)) {
      return this.postgres.getGrades(institutionId!, userId);
    }

    const applicationDb = supabase.schema('applicant');
    const studentDb = supabase.schema('student');

    const { data: ap } = await applicationDb.from('applicant_profiles')
      .select('first_name, last_name, program').eq('id', userId).maybeSingle();
    const studentName = ap ? `${ap.first_name} ${ap.last_name}` : '';
    const program = ap?.program ?? '';

    const { data: sa } = await studentDb.from('student_accounts')
      .select('id').eq('applicant_id', userId).maybeSingle();
    if (!sa) return { studentName, program, grades: [], totalUnits: 0, gwa: '0.00' };

    const { data: gradesData } = await studentDb.from('grades')
      .select('final_grade, remarks, subjects!inner(code, title, units)').eq('student_id', sa.id);

    const grades = (gradesData || []).map((r: any) => ({
      code: r.subjects?.code ?? 'â€”', subject: r.subjects?.title ?? 'â€”',
      units: r.subjects?.units ?? 0, grade: r.final_grade != null ? String(r.final_grade) : 'â€”',
      remarks: r.remarks ?? 'â€”',
    }));
    const totalUnits = grades.reduce((s, g) => s + g.units, 0);
    const nums = grades.map(g => parseFloat(g.grade)).filter(g => !isNaN(g));
    const gwa = nums.length > 0 ? (nums.reduce((s, g) => s + g, 0) / nums.length).toFixed(2) : '0.00';
    return { studentName, program, grades, totalUnits, gwa };
  }

  async getSummary(userId: string, institutionId?: string) {
    const gradeReport = await this.getGrades(userId, institutionId);

    return {
      studentName: gradeReport.studentName,
      program: gradeReport.program,
      ...summarizeGrades(gradeReport.grades),
    };
  }

  async getTermSummary(userId: string, term: string, institutionId?: string) {
    const gradeReport = await this.getGrades(userId, institutionId);

    return {
      studentName: gradeReport.studentName,
      program: gradeReport.program,
      term,
      ...summarizeGrades(gradeReport.grades.filter((grade: any) => grade.term === term || !grade.term)),
    };
  }

  async getDeficiencies(userId: string) {
    const studentDb = supabase.schema('student');
    const { data: sa } = await studentDb.from('student_accounts')
      .select('id').eq('applicant_id', userId).maybeSingle();
    if (!sa) return [];
    const { data } = await studentDb.from('grades')
      .select('final_grade, remarks, subjects!inner(code, title)')
      .eq('student_id', sa.id).in('remarks', ['Failed', 'Incomplete']);
    return (data || []).map((d: any) => ({
      code: d.subjects?.code ?? 'â€”', title: d.subjects?.title ?? 'â€”',
      finalGrade: d.final_grade ?? null, remarks: d.remarks,
    }));
  }

  async getGraduation(userId: string) {
    const applicationDb = supabase.schema('applicant');
    const studentDb = supabase.schema('student');

    const { data: ap } = await applicationDb.from('applicant_profiles')
      .select('first_name, last_name, program').eq('id', userId).maybeSingle();
    const studentName = ap ? `${ap.first_name} ${ap.last_name}` : '';
    const program = ap?.program ?? '';

    const { data: sa } = await studentDb.from('student_accounts')
      .select('id, year_level').eq('applicant_id', userId).maybeSingle();
    if (!sa) return { studentName, program, yearLevel: null, grades: [] };

    const { data: gradesData } = await studentDb.from('grades')
      .select('final_grade, remarks, subjects!inner(code, title, units)')
      .eq('student_id', sa.id).not('final_grade', 'is', null);

    return {
      studentName, program, yearLevel: sa.year_level ?? null,
      grades: (gradesData || []).map((g: any) => ({
        code: g.subjects?.code ?? 'â€”', title: g.subjects?.title ?? 'â€”',
        units: g.subjects?.units ?? 0, finalGrade: g.final_grade, remarks: g.remarks,
      })),
    };
  }

  private async assertEnrollmentBelongsToProfessor(professorId: string, enrollmentId: string) {
    const db = supabase.schema('public');
    const { data, error } = await db.from('class_enrollments')
      .select('id, class_assignments!inner(professor_id)')
      .eq('id', enrollmentId)
      .eq('class_assignments.professor_id', professorId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ForbiddenException('Professor is not assigned to this enrollment.');
  }

  private usePostgres(institutionId?: string) {
    return Boolean(institutionId?.trim() && process.env.ACADEMICS_DATABASE_URL?.trim());
  }

  private async publishGradeSubmittedEvent(payload: any, institutionId?: string | null) {
    await tryPublishDomainEvent(this.eventPublisher, {
      eventType: 'grade.submitted',
      tenantId: institutionId ?? null,
      actorId: payload.professorId ?? null,
      payload: {
        enrollmentId: payload.enrollmentId,
        professorId: payload.professorId,
        finalGrade: payload.finalGrade,
        letterGrade: payload.letterGrade,
      },
    });
  }
}

function toGradeRow(payload: any) {
  return {
    enrollment_id: payload.enrollmentId,
    professor_id: payload.professorId,
    prelim_grade: payload.prelimGrade ?? null,
    midterm_grade: payload.midtermGrade ?? null,
    finals_grade: payload.finalsGrade ?? null,
    final_grade: payload.finalGrade ?? null,
    letter_grade: payload.letterGrade ?? null,
    remarks: payload.remarks ?? null,
    encoded_by: payload.professorId,
    updated_at: new Date().toISOString(),
  };
}

export function summarizeGrades(grades: Array<{ units: number; grade: string; remarks?: string }>) {
  const totalUnits = grades.reduce((sum, grade) => sum + Number(grade.units ?? 0), 0);
  const numericGrades = grades
    .map((grade) => ({
      units: Number(grade.units ?? 0),
      value: Number.parseFloat(grade.grade),
      remarks: grade.remarks,
    }))
    .filter((grade) => Number.isFinite(grade.value));
  const gradedUnits = numericGrades.reduce((sum, grade) => sum + grade.units, 0);
  const weightedTotal = numericGrades.reduce((sum, grade) => sum + grade.value * grade.units, 0);
  const failedUnits = numericGrades
    .filter((grade) => isFailedGradeValue(grade.value, grade.remarks))
    .reduce((sum, grade) => sum + grade.units, 0);
  const passedUnits = Math.max(gradedUnits - failedUnits, 0);

  return {
    totalUnits,
    gradedUnits,
    passedUnits,
    failedUnits,
    gwa: gradedUnits ? (weightedTotal / gradedUnits).toFixed(2) : '0.00',
    status: getAcademicStanding(grades.length, failedUnits),
  };
}

function getAcademicStanding(totalGradeRows: number, failedUnits: number) {
  if (!totalGradeRows) return 'no_grades';
  if (failedUnits > 0) return 'has_deficiencies';
  return 'good_standing';
}

function isFailedGradeValue(value: number, remarks?: string) {
  const normalizedRemarks = remarks?.trim().toLowerCase();
  if (normalizedRemarks === 'failed') return true;
  if (normalizedRemarks === 'passed') return false;

  if (value > 5) return value < 75;
  return value >= 5;
}

