import { Injectable, BadRequestException } from '@nestjs/common';
import { supabase } from '@campus-one/database/supabase';
import { PostgresAcademicsRepository } from '../academics-postgres.repository';
import { domainEventPublisher, tryPublishDomainEvent } from '../../../events/src/domain-events';

@Injectable()
export class EnrollmentService {
  private readonly db = supabase.schema('enrollment');
  private readonly postgres = new PostgresAcademicsRepository();
  private readonly eventPublisher = domainEventPublisher;

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

  async getOfferings(studentId?: string, program?: string, yearLevel?: string, institutionId?: string) {
    if (this.usePostgres(institutionId)) {
      return this.postgres.listOfferings({
        institutionId: institutionId!,
        studentId,
        program,
        yearLevel: yearLevel ? parseInt(yearLevel) : undefined,
      });
    }

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

  async submit(studentId: string, classAssignmentIds: string[], institutionId?: string) {
    if (!studentId || !classAssignmentIds?.length)
      throw new BadRequestException('Missing required fields: studentId and classAssignmentIds');
    if (findDuplicateClassAssignmentIds(classAssignmentIds).length)
      throw new BadRequestException('Duplicate class selections are not allowed');
    if (this.usePostgres(institutionId)) {
      const result = await this.postgres.submitEnrollment({
        institutionId: institutionId!,
        studentId,
        classAssignmentIds,
      });
      await this.publishEnrollmentSubmittedEvent(studentId, classAssignmentIds, institutionId!, result?.count ?? classAssignmentIds.length);
      return result;
    }

    const { data: existing } = await this.db
      .from('class_enrollments').select('class_assignment_id')
      .eq('student_id', studentId).in('class_assignment_id', classAssignmentIds)
      .eq('enrollment_status', 'enrolled');
    if (existing?.length)
      throw new BadRequestException('Student is already enrolled in one or more of these classes');

    const { data: assignments } = await this.db
      .from('class_assignments').select('id, max_students, schedule').in('id', classAssignmentIds);
    if ((assignments || []).length !== classAssignmentIds.length)
      throw new BadRequestException('One or more selected classes are no longer available');
    if (hasScheduleConflict(assignments || []))
      throw new BadRequestException('Selected classes have a schedule conflict');

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

    const count = data?.length || 0;
    await this.publishEnrollmentSubmittedEvent(studentId, classAssignmentIds, institutionId ?? null, count);
    return { success: true, message: 'Successfully enrolled in classes', enrollments: data, count };
  }

  async addDrop(payload: {
    studentId: string;
    addClassAssignmentIds?: string[];
    dropEnrollmentIds?: string[];
    reason?: string;
  }) {
    const record = {
      student_id: payload.studentId,
      request_type: 'add_drop',
      add_class_assignment_ids: payload.addClassAssignmentIds ?? [],
      drop_enrollment_ids: payload.dropEnrollmentIds ?? [],
      reason: payload.reason ?? null,
      status: 'pending_registrar_review',
      requested_at: new Date().toISOString(),
    };

    const { data, error } = await this.db
      .from('enrollment_requests')
      .insert(record)
      .select('id, status, request_type, requested_at')
      .single();
    if (error) throw new Error(error.message);

    await this.writeAuditEvent(payload.studentId, 'enrollment.add_drop.requested', data);
    return { success: true, status: 'pending_registrar_review', request: data };
  }

  async requestIrregularApproval(payload: {
    studentId: string;
    classAssignmentIds: string[];
    reason: string;
  }) {
    const { data, error } = await this.db
      .from('enrollment_requests')
      .insert({
        student_id: payload.studentId,
        request_type: 'irregular_enrollment',
        add_class_assignment_ids: payload.classAssignmentIds,
        reason: payload.reason,
        status: 'pending_adviser_review',
        requested_at: new Date().toISOString(),
      })
      .select('id, status, request_type, requested_at')
      .single();
    if (error) throw new Error(error.message);

    await this.writeAuditEvent(payload.studentId, 'enrollment.irregular.requested', data);
    return { success: true, status: 'pending_adviser_review', request: data };
  }

  async approveByRegistrar(payload: { requestId: string; registrarId: string; notes?: string }) {
    const { data, error } = await this.db
      .from('enrollment_requests')
      .update({
        status: 'approved',
        registrar_id: payload.registrarId,
        registrar_notes: payload.notes ?? null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', payload.requestId)
      .select('id, student_id, status, request_type, approved_at')
      .single();
    if (error) throw new Error(error.message);

    await this.writeAuditEvent(data.student_id, 'enrollment.registrar.approved', data);
    return { success: true, status: 'approved', request: data };
  }

  async confirm(payload: { studentId: string; enrollmentIds: string[] }) {
    const confirmedAt = new Date().toISOString();
    const { data, error } = await this.db
      .from('class_enrollments')
      .update({
        enrollment_status: 'confirmed',
        confirmed_at: confirmedAt,
      })
      .eq('student_id', payload.studentId)
      .in('id', payload.enrollmentIds)
      .select('id, enrollment_status, confirmed_at');
    if (error) throw new Error(error.message);

    await this.writeAuditEvent(payload.studentId, 'enrollment.confirmed', {
      enrollmentIds: payload.enrollmentIds,
      confirmedAt,
    });

    return {
      success: true,
      status: 'confirmed',
      confirmedAt,
      enrollments: data ?? [],
      count: data?.length ?? 0,
    };
  }

  async getStatus(studentId: string, institutionId?: string) {
    if (this.usePostgres(institutionId)) {
      return this.postgres.getEnrollmentStatus(institutionId!, studentId);
    }

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

  private async writeAuditEvent(studentId: string, action: string, metadata: unknown) {
    await this.db
      .from('enrollment_audit_events')
      .insert({
        student_id: studentId,
        action,
        metadata,
        created_at: new Date().toISOString(),
      });
  }

  private usePostgres(institutionId?: string) {
    return Boolean(institutionId?.trim() && process.env.ACADEMICS_DATABASE_URL?.trim());
  }

  private async publishEnrollmentSubmittedEvent(
    studentId: string,
    classAssignmentIds: string[],
    institutionId: string | null,
    enrollmentCount: number,
  ) {
    await tryPublishDomainEvent(this.eventPublisher, {
      eventType: 'enrollment.submitted',
      tenantId: institutionId,
      actorId: studentId,
      payload: {
        studentId,
        classAssignmentIds,
        enrollmentCount,
      },
    });
  }
}

type ScheduledClass = {
  id: string;
  schedule?: string | null;
};

type ScheduleWindow = {
  id: string;
  day: string;
  start: number;
  end: number;
};

type EnrollmentPeriod = {
  status?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

type StudentEligibilityInput = {
  enrollmentStatus?: string | null;
  holds?: Array<unknown> | null;
};

export function findDuplicateClassAssignmentIds(classAssignmentIds: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of classAssignmentIds) {
    const normalized = id.trim();
    if (seen.has(normalized)) duplicates.add(normalized);
    seen.add(normalized);
  }

  return [...duplicates];
}

export function hasScheduleConflict(classes: ScheduledClass[]) {
  const windows = classes.flatMap((scheduledClass) => parseScheduleWindows(scheduledClass));

  return windows.some((window, index) => {
    return windows.slice(index + 1).some((candidate) => {
      return (
        window.id !== candidate.id &&
        window.day === candidate.day &&
        window.start < candidate.end &&
        candidate.start < window.end
      );
    });
  });
}

export function isEnrollmentPeriodOpen(period: EnrollmentPeriod | null | undefined, now = new Date()) {
  if (!period || period.status !== 'open') return false;
  const startsAt = period.startsAt ? new Date(period.startsAt) : null;
  const endsAt = period.endsAt ? new Date(period.endsAt) : null;

  if (startsAt && Number.isFinite(startsAt.getTime()) && now < startsAt) return false;
  if (endsAt && Number.isFinite(endsAt.getTime()) && now > endsAt) return false;

  return true;
}

export function validateStudentEligibility(input: StudentEligibilityInput) {
  const holds = input.holds ?? [];
  if (input.enrollmentStatus !== 'active') {
    return { eligible: false, reason: 'student_not_active' };
  }
  if (holds.length > 0) {
    return { eligible: false, reason: 'student_has_holds' };
  }

  return { eligible: true, reason: null };
}

export function listMissingPrerequisites(requiredSubjectIds: string[], completedSubjectIds: string[]) {
  const completed = new Set(completedSubjectIds);
  return requiredSubjectIds.filter((subjectId) => !completed.has(subjectId));
}

export function validateCurriculumPath(selectedSubjectIds: string[], curriculumSubjectIds: string[]) {
  const allowed = new Set(curriculumSubjectIds);
  return selectedSubjectIds.filter((subjectId) => !allowed.has(subjectId));
}

function parseScheduleWindows(scheduledClass: ScheduledClass): ScheduleWindow[] {
  const schedule = scheduledClass.schedule?.trim();
  if (!schedule || schedule.toUpperCase() === 'TBA') return [];

  const match = schedule.match(/^(?<days>[A-Za-z/,\s]+)\s+(?<start>\d{1,2}:\d{2})\s*-\s*(?<end>\d{1,2}:\d{2})/);
  if (!match?.groups) return [];

  const start = toMinutes(match.groups.start);
  const end = toMinutes(match.groups.end);
  if (start == null || end == null || start >= end) return [];

  return parseDays(match.groups.days).map((day) => ({
    id: scheduledClass.id,
    day,
    start,
    end,
  }));
}

function parseDays(daysText: string) {
  return daysText
    .split(/[\/,\s]+/)
    .map((day) => normalizeDay(day))
    .filter((day): day is string => Boolean(day));
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

