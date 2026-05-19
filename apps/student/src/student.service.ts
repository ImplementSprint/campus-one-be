import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from './config/supabase.config';
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

  // ─── Health ────────────────────────────────────────────────────────────────

  getHealth() {
    return { status: 'ok', service: 'student', version: '1.0.0' };
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

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

  // ─── List Students ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/student
   * Returns all students joined with their applicant profile.
   */
  async findAll(): Promise<IStudentWithProfile[]> {
    const supabase = getSupabaseClient('student');
    const applicationDb = (supabase as any).schema('application');

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
      this.logger.error('findAll failed', error.message);
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

  // ─── Get One Student ───────────────────────────────────────────────────────

  /**
   * GET /api/v1/student/:id
   * Returns a single student with their full applicant profile.
   */
  async findOne(id: string): Promise<IStudentWithProfile> {
    const supabase = getSupabaseClient('student');
    const applicationDb = (supabase as any).schema('application');

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

  // ─── Update Status ─────────────────────────────────────────────────────────

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
      this.logger.error(`updateStatus failed for ${id}`, error.message);
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(`Student ${id} status updated to ${dto.enrollment_status}`);
    return data as IStudentRecord;
  }

  // ─── Update Info ───────────────────────────────────────────────────────────

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
      this.logger.error(`updateInfo failed for ${id}`, error.message);
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(`Student ${id} info updated`);
    return data as IStudentRecord;
  }
}
