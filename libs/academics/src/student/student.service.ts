import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from './config/supabase.config';
import { redactLogError } from '../../../observability/src/log-redaction';
import {
  IStudentRecord,
  IStudentStats,
  IStudentWithProfile,
} from './interfaces/student.interface';
import { UpdateStudentInfoDto, UpdateStudentStatusDto } from './dto/update-student.dto';

const TABLE_STUDENTS = 'student_accounts';
const TABLE_PROFILES = 'applicant_profiles';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  // â”€â”€â”€ Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  getHealth() {
    return { status: 'ok', service: 'student', version: '1.0.0' };
  }

  // â”€â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * GET /api/v1/student/stats
   * Returns total, active, inactive, and pending student counts.
   */
  async getStats(): Promise<IStudentStats> {
    const supabase = getSupabaseClient('student');

    const [total, active, inactive, pending] = await Promise.all([
      supabase.from(TABLE_STUDENTS).select('*', { count: 'exact', head: true }),
      supabase.from(TABLE_STUDENTS).select('*', { count: 'exact', head: true }).eq('enrollment_status', 'active'),
      supabase.from(TABLE_STUDENTS).select('*', { count: 'exact', head: true }).eq('enrollment_status', 'inactive'),
      supabase.from(TABLE_STUDENTS).select('*', { count: 'exact', head: true }).is('password_hash', null),
    ]);

    return {
      total: total.count ?? 0,
      active: active.count ?? 0,
      inactive: inactive.count ?? 0,
      pending: pending.count ?? 0,
    };
  }

  // â”€â”€â”€ List Students â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * GET /api/v1/student
   * Returns all students joined with their applicant profile.
   */
  async findAll(): Promise<IStudentWithProfile[]> {
    const supabase = getSupabaseClient('student');
    const applicationDb = (supabase as any).schema('applicant');

    const { data, error } = await supabase
      .from(TABLE_STUDENTS)
      .select(`
        id,
        email,
        student_number,
        applicant_id,
        enrollment_status,
        enrolled_at,
        password_hash,
      `)
      .order('enrolled_at', { ascending: false });

    if (error) {
      this.logger.error('findAll failed', redactLogError(error));
      throw new InternalServerErrorException(error.message);
    }

    const students = (data ?? []) as unknown as IStudentRecord[];
    const applicantIds = [...new Set(students.map((student) => student.applicant_id).filter(Boolean))];

    const { data: profiles } = applicantIds.length
      ? await applicationDb
          .from(TABLE_PROFILES)
          .select('id, full_name, first_name, last_name, middle_name, birthdate, mobile_number, address, school_level, applicant_type, program')
          .in('id', applicantIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

    return students.map((student) => ({
      ...student,
      applicant_profiles: profileMap.get(student.applicant_id) ?? null,
    })) as IStudentWithProfile[];
  }

  // â”€â”€â”€ Get One Student â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * GET /api/v1/student/:id
   * Returns a single student with their full applicant profile.
   */
  async findOne(id: string): Promise<IStudentWithProfile> {
    const supabase = getSupabaseClient('student');
    const applicationDb = (supabase as any).schema('applicant');

    const { data, error } = await supabase
      .from(TABLE_STUDENTS)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Student not found: ${id}`);
    }

    const { data: profile } = await applicationDb
      .from(TABLE_PROFILES)
      .select('id, full_name, first_name, last_name, middle_name, birthdate, mobile_number, address, school_level, applicant_type, program')
      .eq('id', data.applicant_id)
      .maybeSingle();

    return {
      ...data,
      applicant_profiles: profile ?? null,
    } as IStudentWithProfile;
  }

  async getEnrolledCourses(id: string) {
    const enrollmentDb = getSupabaseClient('enrollment');
    const { data, error } = await enrollmentDb
      .from('class_enrollments')
      .select(`id, enrollment_status, enrolled_at,
        class_assignments!inner(id, section, schedule, room, subjects!inner(code, name, units))`)
      .eq('student_id', id)
      .eq('enrollment_status', 'enrolled')
      .order('enrolled_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      status: row.enrollment_status,
      enrolledAt: row.enrolled_at,
      classAssignmentId: row.class_assignments?.id ?? null,
      subjectCode: row.class_assignments?.subjects?.code ?? null,
      subjectName: row.class_assignments?.subjects?.name ?? null,
      units: row.class_assignments?.subjects?.units ?? 0,
      section: row.class_assignments?.section ?? null,
      schedule: row.class_assignments?.schedule ?? null,
      room: row.class_assignments?.room ?? null,
    }));
  }

  async getClassSchedule(id: string) {
    const courses = await this.getEnrolledCourses(id);

    return courses.map((course: any) => ({
      id: course.classAssignmentId ?? course.id,
      enrollmentId: course.id,
      subjectCode: course.subjectCode,
      subjectName: course.subjectName,
      section: course.section,
      schedule: course.schedule,
      room: course.room,
    }));
  }

  async getCurriculumProgress(id: string) {
    const enrollmentDb = getSupabaseClient('enrollment');
    const student = await this.findOne(id);
    const program = (student as any).applicant_profiles?.program;

    const [curriculumResult, enrolledCourses] = await Promise.all([
      program
        ? enrollmentDb
            .from('curriculum')
            .select('subject_id, subjects!inner(units)')
            .eq('program', program)
        : Promise.resolve({ data: [], error: null }),
      this.getEnrolledCourses(id),
    ]);

    if (curriculumResult.error) {
      throw new InternalServerErrorException(curriculumResult.error.message);
    }

    const requiredUnits = (curriculumResult.data ?? []).reduce(
      (sum: number, row: any) => sum + Number(row.subjects?.units ?? 0),
      0,
    );
    const completedUnits = enrolledCourses.reduce(
      (sum: number, course: any) => sum + Number(course.units ?? 0),
      0,
    );

    return {
      studentId: id,
      program: program ?? null,
      requiredUnits,
      completedUnits,
      remainingUnits: Math.max(requiredUnits - completedUnits, 0),
      completionPercent: requiredUnits ? Math.round((completedUnits / requiredUnits) * 100) : 0,
    };
  }

  async getHoldsAndDeficiencies(id: string) {
    const [holdsResult, deficienciesResult] = await Promise.all([
      getSupabaseClient('student')
        .from('student_holds')
        .select('id, type, reason, status, created_at')
        .eq('student_id', id)
        .eq('status', 'active'),
      getSupabaseClient('student')
        .from('grades')
        .select('id, final_grade, remarks, subjects!inner(code, title)')
        .eq('student_id', id)
        .in('remarks', ['Failed', 'Incomplete']),
    ]);

    if (holdsResult.error) throw new InternalServerErrorException(holdsResult.error.message);
    if (deficienciesResult.error) throw new InternalServerErrorException(deficienciesResult.error.message);

    return {
      holds: (holdsResult.data ?? []).map((row: any) => ({
        id: row.id,
        type: row.type,
        reason: row.reason,
        status: row.status,
        createdAt: row.created_at,
      })),
      deficiencies: (deficienciesResult.data ?? []).map((row: any) => ({
        id: row.id,
        subjectCode: row.subjects?.code ?? null,
        subjectTitle: row.subjects?.title ?? null,
        finalGrade: row.final_grade,
        remarks: row.remarks,
      })),
    };
  }

  async getAnnouncements(id: string) {
    const { data, error } = await getSupabaseClient('public')
      .from('announcements')
      .select('id, title, body, audience, created_at')
      .or(`student_id.eq.${id},audience.eq.students,audience.eq.all`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new InternalServerErrorException(error.message);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      audience: row.audience,
      createdAt: row.created_at,
    }));
  }

  // â”€â”€â”€ Update Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * PATCH /api/v1/student/:id/status
   * Activates or deactivates a student account.
   */
  async updateStatus(id: string, dto: UpdateStudentStatusDto): Promise<IStudentRecord> {
    const supabase = getSupabaseClient('student');

    const { data, error } = await supabase
      .from(TABLE_STUDENTS)
      .update({ enrollment_status: dto.enrollment_status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`updateStatus failed for ${id}`, redactLogError(error));
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(`Student ${id} status updated to ${dto.enrollment_status}`);
    return data as IStudentRecord;
  }

  // â”€â”€â”€ Update Info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * PATCH /api/v1/student/:id
   * Updates basic student account fields (email, student_number).
   */
  async updateInfo(id: string, dto: UpdateStudentInfoDto): Promise<IStudentRecord> {
    const supabase = getSupabaseClient('student');

    const { data, error } = await supabase
      .from(TABLE_STUDENTS)
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`updateInfo failed for ${id}`, redactLogError(error));
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(`Student ${id} info updated`);
    return data as IStudentRecord;
  }
}


