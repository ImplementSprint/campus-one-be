import { Injectable, BadRequestException } from '@nestjs/common';
import { supabase } from '../../libs/database/supabase';

@Injectable()
export class EnrollmentService {
  private readonly db = supabase.schema('enrollment');

  async getHistory(studentId: string) {
    const studentDb = supabase.schema('student');
    const { data: sa } = await studentDb
      .from('student_accounts').select('id').eq('applicant_id', studentId).maybeSingle();
    if (!sa) return [];

    const { data, error } = await this.db
      .from('class_enrollments')
      .select(`id, enrollment_status, enrolled_at,
        class_assignments!inner(section, schedule, subjects!inner(code, name, units))`)
      .eq('student_id', sa.id)
      .order('enrolled_at', { ascending: false });
    if (error) throw new Error(error.message);

    return (data || []).map((e: any) => ({
      id: e.id, status: e.enrollment_status, enrolledAt: e.enrolled_at,
      subjectCode: e.class_assignments?.subjects?.code,
      subjectName: e.class_assignments?.subjects?.name,
      units: e.class_assignments?.subjects?.units ?? 0,
      section: e.class_assignments?.section,
      schedule: e.class_assignments?.schedule,
    }));
  }

  async getOfferings(studentId?: string, program?: string, yearLevel?: string) {
    let studentProgram = program;
    let studentYearLevel = yearLevel ? parseInt(yearLevel) : undefined;
    const studentDb = supabase.schema('student');
    const applicantDb = supabase.schema('applicant');

    if (studentId && (!program || !yearLevel)) {
      const { data: student } = await studentDb
        .from('student_accounts').select('applicant_id').eq('id', studentId).maybeSingle();
      if (student?.applicant_id) {
        const { data: ps } = await applicantDb
          .from('program_selections').select('college_program, school_level')
          .eq('applicant_id', student.applicant_id).maybeSingle();
        if (ps) {
          studentProgram = ps.college_program;
          const levelMap: Record<string, number> = { Freshman: 1, Sophomore: 2, Junior: 3, Senior: 4 };
          studentYearLevel = levelMap[ps.school_level] ?? 1;
        }
      }
    }

    if (!studentProgram || !studentYearLevel) return [];

    const { data: curriculum, error } = await this.db
      .from('curriculum')
      .select('id, program, year_level, term, subject_id, subjects!inner(id, code, name, units, description)')
      .eq('program', studentProgram).eq('year_level', studentYearLevel);
    if (error) throw new Error(error.message);

    const subjectIds = (curriculum || []).map((cs: any) => cs.subject_id);
    if (!subjectIds.length) return [];

    const { data: assignments } = await this.db
      .from('class_assignments')
      .select('id, subject_id, section, schedule, room, max_students, is_active')
      .in('subject_id', subjectIds).eq('is_active', true);

    const { data: counts } = await this.db
      .from('class_enrollments').select('class_assignment_id').eq('enrollment_status', 'enrolled');

    const countMap: Record<string, number> = {};
    (counts || []).forEach((ec: any) => {
      countMap[ec.class_assignment_id] = (countMap[ec.class_assignment_id] || 0) + 1;
    });

    return (curriculum || []).map((cs: any) => {
      const a = (assignments || []).find((ca: any) => ca.subject_id === cs.subject_id);
      return {
        id: a?.id || cs.id, subject_id: cs.subject_id,
        subjectCode: cs.subjects.code, subjectTitle: cs.subjects.name,
        units: cs.subjects.units, description: cs.subjects.description, term: cs.term,
        section: a?.section || 'TBA', schedule: a?.schedule || 'TBA', room: a?.room || 'TBA',
        slotsTotal: a?.max_students || 0,
        slotsTaken: a ? (countMap[a.id] || 0) : 0,
        isFull: a ? ((countMap[a.id] || 0) >= a.max_students) : false,
        hasAssignment: !!a,
      };
    });
  }

  async submit(studentId: string, classAssignmentIds: string[]) {
    if (!studentId || !classAssignmentIds?.length)
      throw new BadRequestException('Missing required fields: studentId and classAssignmentIds');

    const { data: existing } = await this.db
      .from('class_enrollments').select('class_assignment_id')
      .eq('student_id', studentId).in('class_assignment_id', classAssignmentIds)
      .eq('enrollment_status', 'enrolled');
    if (existing?.length)
      throw new BadRequestException('Student is already enrolled in one or more of these classes');

    const { data: assignments } = await this.db
      .from('class_assignments').select('id, max_students').in('id', classAssignmentIds);
    const { data: enrollmentCounts } = await this.db
      .from('class_enrollments').select('class_assignment_id')
      .in('class_assignment_id', classAssignmentIds).eq('enrollment_status', 'enrolled');

    const countMap: Record<string, number> = {};
    (enrollmentCounts || []).forEach((ec: any) => {
      countMap[ec.class_assignment_id] = (countMap[ec.class_assignment_id] || 0) + 1;
    });

    const fullClasses = (assignments || []).filter((ca: any) => (countMap[ca.id] || 0) >= ca.max_students);
    if (fullClasses.length) throw new BadRequestException('One or more classes are full');

    const records = classAssignmentIds.map(id => ({
      student_id: studentId, class_assignment_id: id,
      enrollment_status: 'enrolled', enrolled_at: new Date().toISOString(),
    }));

    const { data, error } = await this.db.from('class_enrollments').insert(records)
      .select(`id, enrollment_status, enrolled_at,
        class_assignments!inner(section, schedule, room, subjects!inner(code, name, units))`);
    if (error) throw new Error(error.message);

    return { success: true, message: 'Successfully enrolled in classes', enrollments: data, count: data?.length || 0 };
  }

  async getStatus(studentId: string) {
    const { data: enrollments, error } = await this.db
      .from('class_enrollments')
      .select(`id, enrollment_status, enrolled_at, class_assignment_id,
        class_assignments!inner(subject_id, section, schedule, room, subjects!inner(code, name, units))`)
      .eq('student_id', studentId).eq('enrollment_status', 'enrolled');
    if (error) throw new Error(error.message);

    const totalUnits = (enrollments || []).reduce((sum: number, e: any) =>
      sum + (e.class_assignments?.subjects?.units || 0), 0);

    return {
      isEnrolled: !!(enrollments?.length),
      enrollmentCount: enrollments?.length || 0,
      totalUnits,
      enrollments: (enrollments || []).map((e: any) => ({
        id: e.id, status: e.enrollment_status, enrolledAt: e.enrolled_at,
        classAssignmentId: e.class_assignment_id,
        subject: {
          code: e.class_assignments?.subjects?.code,
          name: e.class_assignments?.subjects?.name,
          units: e.class_assignments?.subjects?.units,
        },
        section: e.class_assignments?.section,
        schedule: e.class_assignments?.schedule,
        room: e.class_assignments?.room,
      })),
    };
  }
}
