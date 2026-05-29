import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { domainEventPublisher, tryPublishDomainEvent } from '../../../events/src/domain-events';
import { createSupabaseFileStorageService } from '../../../files/src/file-storage';
import { PostgresAdmissionsRepository } from './admissions-postgres.repository';

type ServiceResponse<T> = { data: T | null; error: { message: string; code?: string } | null };
export const ADMISSIONS_WORKFLOW_STATUSES = [
  'Under Review',
  'Missing Requirements',
  'For Exam',
  'For Interview',
  'Accepted',
  'Rejected',
  'Waitlisted',
  'Passed',
  'Not Accepted',
] as const;
export type AdmissionsWorkflowStatus = (typeof ADMISSIONS_WORKFLOW_STATUSES)[number];
type WorkflowActor = { actorEmail?: string; remarks?: string };
export type AdmissionsNotificationPayload = {
  applicationId: string;
  status: AdmissionsWorkflowStatus;
  applicant: {
    email: string | null;
    mobileNumber: string | null;
    fullName: string | null;
    referenceNumber: string | null;
  };
  channels: Array<'email' | 'sms'>;
  metadata: {
    actorEmail: string | null;
    remarks: string | null;
    rejectionReason: string | null;
    acceptanceLetterUrl: string | null;
  };
};
export type AdmissionsNotificationAdapter = {
  sendApplicantStatusUpdate(payload: AdmissionsNotificationPayload): Promise<unknown>;
};

@Injectable()
export class ApplicationService {
  private readonly supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-key',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  private readonly db = this.supabase.schema('applicant');
  private readonly studentDb = this.supabase.schema('public');
  private readonly postgres = new PostgresAdmissionsRepository();
  private readonly eventPublisher = domainEventPublisher;
  private readonly fileStorage = createSupabaseFileStorageService(this.supabase);
  notificationAdapter?: AdmissionsNotificationAdapter;

  getHello(): string {
    return 'Application service is running.';
  }

  private ensureSupabaseConfig(): void {
    if (!process.env.SUPABASE_URL || (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY)) {
      throw new InternalServerErrorException('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
    }
  }

  async logAdmissionEvent(dto: any): Promise<ServiceResponse<{ id: string }>> {
    this.ensureSupabaseConfig();
    const { data, error } = await this.db
      .from('Admissions_Activity_Logs')
      .insert({
        event_type: dto.event_type,
        applicant_type: dto.applicant_type,
        school_level: dto.school_level,
        metadata: dto.metadata ?? {},
      })
      .select('id')
      .single();
    if (error) return { data: null, error: { message: error.message, code: error.code } };
    return { data: data as { id: string }, error: null };
  }

  async createApplicantProfile(dto: any, institutionId?: string): Promise<ServiceResponse<{ id: string }>> {
    if (this.usePostgres(institutionId)) {
      return this.postgres.createApplicantProfile({
        institutionId: institutionId!,
        email: dto.email,
        schoolLevel: dto.school_level,
        applicantType: dto.applicant_type,
      });
    }

    const applicantId = randomUUID();
    const { error } = await this.db.from('applicant_profiles').insert({
      id: applicantId,
      email: dto.email,
      school_level: dto.school_level,
      applicant_type: dto.applicant_type,
      full_name: '',
      first_name: '',
      last_name: '',
      status: 'Under Review',
    });
    if (error) return { data: null, error: { message: error.message } };
    return { data: { id: applicantId }, error: null };
  }

  async submitApplication(applicantId: string, institutionId?: string): Promise<ServiceResponse<{ reference_number: string }>> {
    if (this.usePostgres(institutionId)) {
      const result = await this.postgres.submitApplication(institutionId!, applicantId);
      if (!result.error) {
        await this.publishApplicationSubmittedEvent(applicantId, institutionId!, result.data?.reference_number ?? null);
      }
      return result;
    }

    const { data, error } = await this.db
      .from('applicant_profiles')
      .update({
        application_submitted_at: new Date().toISOString(),
        status: 'Under Review',
      })
      .eq('id', applicantId)
      .select('reference_number')
      .single();
    if (error) return { data: null, error: { message: error.message } };
    await this.publishApplicationSubmittedEvent(applicantId, institutionId ?? null, data.reference_number as string);
    return { data: { reference_number: data.reference_number as string }, error: null };
  }

  async trackApplication(email: string, referenceNumber: string, institutionId?: string): Promise<ServiceResponse<{ id: string }>> {
    if (this.usePostgres(institutionId)) {
      return this.postgres.trackApplication(institutionId!, email, referenceNumber);
    }

    const { data, error } = await this.db
      .from('applicant_profiles')
      .select('id')
      .eq('email', email)
      .eq('reference_number', referenceNumber)
      .single();
    if (error) return { data: null, error: { message: 'Invalid email or reference number' } };
    return { data: { id: data.id as string }, error: null };
  }

  async saveApplicantProfile(dto: any, institutionId?: string): Promise<ServiceResponse<{ id: string }>> {
    if (this.usePostgres(institutionId)) {
      return this.postgres.saveApplicantProfile({
        institutionId: institutionId!,
        applicantId: dto.applicant_id,
        firstName: dto.first_name,
        lastName: dto.last_name,
        middleName: dto.middle_name,
        birthdate: dto.birthdate,
        mobileNumber: dto.mobile_number,
        address: dto.address,
        schoolLevel: dto.school_level,
        applicantType: dto.applicant_type,
      });
    }

    const fullName = `${dto.first_name} ${dto.last_name}`.trim();
    const { error } = await this.db
      .from('applicant_profiles')
      .update({
        first_name: dto.first_name,
        last_name: dto.last_name,
        middle_name: dto.middle_name,
        full_name: fullName,
        birthdate: dto.birthdate,
        mobile_number: dto.mobile_number,
        address: dto.address,
        school_level: dto.school_level,
        applicant_type: dto.applicant_type,
      })
      .eq('id', dto.applicant_id);
    if (error) return { data: null, error: { message: error.message } };
    return { data: { id: dto.applicant_id }, error: null };
  }

  async uploadApplicantDocument(dto: any, institutionId?: string): Promise<ServiceResponse<any>> {
    const tenantId = institutionId ?? dto.institution_id ?? dto.tenant_id;
    if (!tenantId) return { data: null, error: { message: 'institution id is required for document upload' } };

    let storedFile: { storageUrl?: string };
    try {
      storedFile = await this.fileStorage.uploadBase64({
        bucket: 'applicantDocuments',
        tenantId,
        ownerType: 'applicant',
        ownerId: dto.applicant_id,
        fileName: dto.file_name,
        contentType: dto.file_type || 'application/octet-stream',
        fileBase64: dto.file_base64,
      });
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'document upload failed' } };
    }

    const { data, error: dbError } = await this.db
      .from('applicant_documents')
      .insert({
        institution_id: tenantId,
        applicant_id: dto.applicant_id,
        document_name: dto.document_name,
        file_name: dto.file_name,
        file_url: storedFile.storageUrl,
        status: 'submitted',
        school_level: dto.school_level,
        applicant_type: dto.applicant_type,
      })
      .select()
      .single();
    if (dbError) return { data: null, error: { message: dbError.message } };
    return { data, error: null };
  }

  async getApplicantAdmissionResult(applicantId: string): Promise<ServiceResponse<any>> {
    const { data, error } = await this.db
      .from('admissions_results')
      .select(
        'id, applicant_id, status, noa_url, exam_permit_url, exam_date, exam_time, exam_venue, permit_number, date_issued, applicant_profiles ( full_name, program, school_level, applicant_type )',
      )
      .eq('applicant_id', applicantId)
      .single();
    if (error) return { data: null, error: { message: error.message } };
    return { data, error: null };
  }

  async saveParentInformation(payload: any): Promise<ServiceResponse<{ id: string }>> {
    const { error } = await this.db
      .from('parent_information')
      .upsert(payload, { onConflict: 'applicant_id' });
    if (error) return { data: null, error: { message: error.message } };
    return { data: { id: payload.applicant_id }, error: null };
  }

  async saveAcademicBackground(payload: any): Promise<ServiceResponse<{ count: number }>> {
    await this.db.from('academic_background').delete().eq('applicant_id', payload.applicant_id);
    const records = (payload.entries || []).map((entry: any) => ({
      applicant_id: payload.applicant_id,
      grade_level: entry.grade_level,
      school_name: entry.school_name,
      completion_year: entry.completion_year,
    }));
    if (records.length === 0) return { data: { count: 0 }, error: null };
    const { error } = await this.db.from('academic_background').insert(records);
    if (error) return { data: null, error: { message: error.message } };
    return { data: { count: records.length }, error: null };
  }

  async saveAlumniRelatives(payload: any): Promise<ServiceResponse<{ count: number }>> {
    await this.db.from('alumni_relatives').delete().eq('applicant_id', payload.applicant_id);
    const records = (payload.relatives || []).map((relative: any) => ({
      applicant_id: payload.applicant_id,
      name: relative.name,
      relationship: relative.relationship,
      college: relative.college,
      batch_year: relative.batch_year,
      contact_number: relative.contact_number,
    }));
    if (records.length === 0) return { data: { count: 0 }, error: null };
    const { error } = await this.db.from('alumni_relatives').insert(records);
    if (error) return { data: null, error: { message: error.message } };
    return { data: { count: records.length }, error: null };
  }

  async saveProgramSelection(payload: any, institutionId?: string): Promise<ServiceResponse<{ id: string }>> {
    if (this.usePostgres(institutionId)) {
      return this.postgres.saveProgramSelection({
        institutionId: institutionId!,
        applicantId: payload.applicant_id,
        schoolLevel: payload.school_level,
        collegeProgram: payload.college_program,
        collegeDepartment: payload.college_department,
        seniorHighTrack: payload.senior_high_track,
      });
    }

    const { error } = await this.db
      .from('program_selections')
      .upsert(payload, { onConflict: 'applicant_id' });
    if (error) return { data: null, error: { message: error.message } };
    const programName = payload.college_program || payload.senior_high_track || payload.school_level;
    await this.db.from('applicant_profiles').update({ program: programName }).eq('id', payload.applicant_id);
    return { data: { id: payload.applicant_id }, error: null };
  }

  async fetchApplicationStatus(email: string, referenceNumber: string, institutionId?: string): Promise<ServiceResponse<any>> {
    if (this.usePostgres(institutionId)) {
      return this.postgres.fetchApplicationStatus(institutionId!, email, referenceNumber);
    }

    const { data: appData, error: appError } = await this.db
      .from('applicant_profiles')
      .select('*')
      .eq('email', email)
      .eq('reference_number', referenceNumber)
      .single();
    if (appError || !appData) return { data: null, error: { message: 'Invalid email or reference number' } };

    const { data: docsData } = await this.db
      .from('applicant_documents')
      .select('*')
      .eq('applicant_id', appData.id)
      .order('submitted_at', { ascending: false });

    return {
      data: {
        application: appData,
        documents: docsData || [],
        progress: [
          { step: 1, label: 'Application Submitted', status: 'completed', date: appData.application_submitted_at },
          {
            step: 2,
            label: 'Under Review',
            status: appData.status === 'Under Review' ? 'current' : 'completed',
            date: appData.application_submitted_at,
          },
          {
            step: 3,
            label: 'Verified by Admin',
            status: appData.status === 'Passed' || appData.status === 'Not Accepted' ? 'completed' : 'pending',
            date: appData.reviewed_at,
          },
          {
            step: 4,
            label: 'Decision Released',
            status: appData.status === 'Passed' || appData.status === 'Not Accepted' ? 'completed' : 'pending',
            date: appData.reviewed_at,
          },
        ],
        remarks: appData.rejection_reason,
      },
      error: null,
    };
  }

  async validateApplicationAccess(email: string, referenceNumber: string, institutionId?: string): Promise<{
    valid: boolean;
    applicantId: string;
    error?: string;
  }> {
    if (this.usePostgres(institutionId)) {
      const result = await this.postgres.trackApplication(institutionId!, email, referenceNumber);
      if (result.error || !result.data) return { valid: false, applicantId: '', error: 'Invalid credentials' };
      return { valid: true, applicantId: result.data.id };
    }

    const { data, error } = await this.db
      .from('applicant_profiles')
      .select('id')
      .eq('email', email)
      .eq('reference_number', referenceNumber)
      .single();
    if (error || !data) return { valid: false, applicantId: '', error: 'Invalid credentials' };
    return { valid: true, applicantId: data.id as string };
  }

  async fetchAdminApplications(institutionId?: string): Promise<ServiceResponse<any[]>> {
    if (this.usePostgres(institutionId)) {
      return this.postgres.fetchAdminApplications(institutionId!);
    }

    const { data, error } = await this.db
      .from('applicant_profiles')
      .select('*')
      .not('application_submitted_at', 'is', null)
      .order('application_submitted_at', { ascending: false });
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data ?? []) as any[], error: null };
  }

  async fetchAdminApplicationDetail(applicationId: string, institutionId?: string): Promise<ServiceResponse<any>> {
    if (this.usePostgres(institutionId)) {
      return this.postgres.fetchAdminApplicationDetail(institutionId!, applicationId);
    }

    const { data: profile, error: profileError } = await this.db
      .from('applicant_profiles')
      .select('*')
      .eq('id', applicationId)
      .single();
    if (profileError) return { data: null, error: { message: profileError.message } };

    const [{ data: parentInfo }, { data: academicBg }, { data: alumni }, { data: documents }, { data: programSelection }] =
      await Promise.all([
        this.db.from('parent_information').select('*').eq('applicant_id', applicationId).single(),
        this.db.from('academic_background').select('*').eq('applicant_id', applicationId).order('grade_level', { ascending: true }),
        this.db.from('alumni_relatives').select('*').eq('applicant_id', applicationId),
        this.db.from('applicant_documents').select('*').eq('applicant_id', applicationId).order('submitted_at', { ascending: false }),
        this.db.from('program_selections').select('*').eq('applicant_id', applicationId).single(),
      ]);

    return {
      data: {
        ...profile,
        parent_info: parentInfo ?? null,
        academic_background: academicBg ?? [],
        alumni_relatives: alumni ?? [],
        documents: documents ?? [],
        program_selection: programSelection ?? null,
      },
      error: null,
    };
  }

  async verifyApplicantDocument(
    applicationId: string,
    documentId: string,
    status: 'approved' | 'rejected' | 'pending',
    options: WorkflowActor & { rejectionReason?: string } = {},
  ): Promise<ServiceResponse<{ success: boolean }>> {
    const { error } = await this.db
      .from('applicant_documents')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: options.actorEmail ?? null,
        rejection_reason: status === 'rejected' ? options.rejectionReason ?? options.remarks ?? null : null,
      })
      .eq('id', documentId)
      .eq('applicant_id', applicationId);

    if (error) return { data: null, error: { message: error.message } };
    await this.recordAdmissionAudit('document_reviewed', applicationId, options, { documentId, status });
    return { data: { success: true }, error: null };
  }

  async recordMissingRequirements(
    applicationId: string,
    requirements: string[],
    options: WorkflowActor = {},
  ): Promise<ServiceResponse<{ success: boolean }>> {
    const { error } = await this.db
      .from('applicant_profiles')
      .update({
        status: 'Missing Requirements',
        rejection_reason: requirements.join('; '),
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (error) return { data: null, error: { message: error.message } };
    await this.recordAdmissionAudit('missing_requirements_recorded', applicationId, options, { requirements });
    return { data: { success: true }, error: null };
  }

  async scheduleEntranceExam(
    applicationId: string,
    schedule: WorkflowActor & {
      examDate: string;
      examTime: string;
      examVenue: string;
      permitNumber?: string;
    },
  ): Promise<ServiceResponse<{ success: boolean }>> {
    const { error } = await this.db
      .from('admissions_results')
      .upsert(
        {
          applicant_id: applicationId,
          status: 'For Exam',
          exam_date: schedule.examDate,
          exam_time: schedule.examTime,
          exam_venue: schedule.examVenue,
          permit_number: schedule.permitNumber ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'applicant_id' },
      );

    if (error) return { data: null, error: { message: error.message } };
    const statusResult = await this.updateApplicantWorkflowStatus(applicationId, 'For Exam');
    if (statusResult.error) return statusResult;
    await this.recordAdmissionAudit('entrance_exam_scheduled', applicationId, schedule, {
      examDate: schedule.examDate,
      examTime: schedule.examTime,
      examVenue: schedule.examVenue,
      permitNumber: schedule.permitNumber ?? null,
    });
    return { data: { success: true }, error: null };
  }

  async scheduleInterview(
    applicationId: string,
    schedule: WorkflowActor & {
      interviewDate: string;
      interviewTime: string;
      interviewVenue: string;
    },
  ): Promise<ServiceResponse<{ success: boolean }>> {
    const statusResult = await this.updateApplicantWorkflowStatus(applicationId, 'For Interview', {
      interviewDate: schedule.interviewDate,
      interviewTime: schedule.interviewTime,
      interviewVenue: schedule.interviewVenue,
    });
    if (statusResult.error) return statusResult;
    await this.recordAdmissionAudit('interview_scheduled', applicationId, schedule, {
      interviewDate: schedule.interviewDate,
      interviewTime: schedule.interviewTime,
      interviewVenue: schedule.interviewVenue,
    });
    return { data: { success: true }, error: null };
  }

  async updateAdminApplicationStatus(
    applicationId: string,
    status: AdmissionsWorkflowStatus,
    options?: string | (WorkflowActor & { rejectionReason?: string; acceptanceLetterUrl?: string }),
    institutionId?: string,
  ): Promise<ServiceResponse<{ success: boolean }>> {
    const normalizedOptions = typeof options === 'string' ? { rejectionReason: options } : options ?? {};
    if (this.usePostgres(institutionId)) {
      const result = await this.postgres.updateAdminApplicationStatus(institutionId!, applicationId, status, normalizedOptions);
      if (!result.error) {
        await this.publishAdmissionsStatusChangedEvent(applicationId, status, normalizedOptions, institutionId!);
      }
      return result;
    }

    const updateData: Record<string, unknown> = {
      status,
      reviewed_at: new Date().toISOString(),
    };

    if (status === 'Passed' || status === 'Accepted') {
      const { data: appNumber } = await this.db.rpc('generate_applicant_number');
      updateData.applicant_number = appNumber;
    }

    if ((status === 'Not Accepted' || status === 'Rejected') && normalizedOptions.rejectionReason) {
      updateData.rejection_reason = normalizedOptions.rejectionReason;
    }

    const { error } = await this.db.from('applicant_profiles').update(updateData).eq('id', applicationId);
    if (error) return { data: null, error: { message: error.message } };
    if (normalizedOptions.acceptanceLetterUrl) {
      const { error: resultError } = await this.db
        .from('admissions_results')
        .upsert(
          {
            applicant_id: applicationId,
            status,
            noa_url: normalizedOptions.acceptanceLetterUrl,
            date_issued: new Date().toISOString().slice(0, 10),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'applicant_id' },
        );
      if (resultError) return { data: null, error: { message: resultError.message } };
    }

    await this.recordAdmissionAudit('status_changed', applicationId, normalizedOptions, {
      status,
      rejectionReason: normalizedOptions.rejectionReason ?? null,
      acceptanceLetterUrl: normalizedOptions.acceptanceLetterUrl ?? null,
    });
    await this.notifyApplicantStatusUpdate(applicationId, status, normalizedOptions);
    await this.publishAdmissionsStatusChangedEvent(applicationId, status, normalizedOptions, institutionId ?? null);
    return { data: { success: true }, error: null };
  }

  async convertAcceptedApplicantToStudent(
    applicationId: string,
    options: WorkflowActor = {},
    institutionId?: string,
  ): Promise<ServiceResponse<{ student_number: string }>> {
    if (this.usePostgres(institutionId)) {
      const result = await this.postgres.convertAcceptedApplicantToStudent(institutionId!, applicationId, options);
      if (!result.error) {
        await this.publishApplicantConvertedEvent(applicationId, result.data?.student_number ?? null, options, institutionId!);
      }
      return result;
    }

    const { data: applicant, error: applicantError } = await this.db
      .from('applicant_profiles')
      .select('id, email, full_name, applicant_number, status')
      .eq('id', applicationId)
      .single();

    if (applicantError || !applicant) {
      return { data: null, error: { message: applicantError?.message ?? 'Application not found' } };
    }

    const studentNumber = applicant.applicant_number || (await this.db.rpc('generate_applicant_number')).data;
    const { data: student, error: studentError } = await this.studentDb
      .from('student_accounts')
      .insert({
        applicant_id: applicationId,
        student_number: studentNumber,
        email: applicant.email,
        password_hash: 'pending-password-setup',
        enrollment_status: 'active',
        is_active: true,
      })
      .select('student_number')
      .single();

    if (studentError) return { data: null, error: { message: studentError.message } };

    const { error: updateError } = await this.db
      .from('applicant_profiles')
      .update({ is_enrolled: true, enrolled_at: new Date().toISOString() })
      .eq('id', applicationId);
    if (updateError) return { data: null, error: { message: updateError.message } };

    await this.recordAdmissionAudit('applicant_converted_to_student', applicationId, options, {
      studentNumber: student?.student_number ?? studentNumber,
    });
    await this.publishApplicantConvertedEvent(applicationId, student?.student_number ?? studentNumber, options, institutionId ?? null);
    return { data: { student_number: student?.student_number ?? studentNumber }, error: null };
  }

  async fetchAdminDashboardStats(): Promise<ServiceResponse<{ total: number; pending: number; accepted: number; rejected: number }>> {
    const { data, error } = await this.db
      .from('applicant_profiles')
      .select('status')
      .not('application_submitted_at', 'is', null);
    if (error) return { data: null, error: { message: error.message } };

    const rows = data ?? [];
    return {
      data: {
        total: rows.length,
        pending: rows.filter((app: any) => app.status === 'Under Review').length,
        accepted: rows.filter((app: any) => app.status === 'Passed' || app.status === 'Accepted').length,
        rejected: rows.filter((app: any) => app.status === 'Not Accepted' || app.status === 'Rejected').length,
      },
      error: null,
    };
  }

  async updateAdminProgramSelection(
    applicationId: string,
    department: string,
    program: string,
    institutionId?: string,
  ): Promise<ServiceResponse<{ success: boolean }>> {
    if (this.usePostgres(institutionId)) {
      const result = await this.postgres.saveProgramSelection({
        institutionId: institutionId!,
        applicantId: applicationId,
        collegeDepartment: department,
        collegeProgram: program,
      });
      return result.error ? { data: null, error: result.error } : { data: { success: true }, error: null };
    }

    const { error } = await this.db
      .from('program_selections')
      .update({
        college_department: department,
        college_program: program,
      })
      .eq('applicant_id', applicationId);
    if (error) return { data: null, error: { message: error.message } };
    return { data: { success: true }, error: null };
  }

  private async updateApplicantWorkflowStatus(
    applicationId: string,
    status: AdmissionsWorkflowStatus,
    metadata: Record<string, unknown> = {},
  ): Promise<ServiceResponse<{ success: boolean }>> {
    const { error } = await this.db
      .from('applicant_profiles')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        ...(metadata.interviewDate ? { rejection_reason: JSON.stringify(metadata) } : {}),
      })
      .eq('id', applicationId);
    if (error) return { data: null, error: { message: error.message } };
    return { data: { success: true }, error: null };
  }

  private async recordAdmissionAudit(
    eventType: string,
    applicationId: string,
    options: WorkflowActor,
    metadata: Record<string, unknown>,
  ) {
    await this.db.from('admissions_activity_logs').insert({
      event_type: eventType,
      applicant_type: 'New Student',
      school_level: 'College',
      metadata: {
        applicant_id: applicationId,
        actor_email: options.actorEmail ?? null,
        remarks: options.remarks ?? null,
        ...metadata,
      },
    });
  }

  private async publishApplicationSubmittedEvent(
    applicationId: string,
    institutionId: string | null,
    referenceNumber: string | null,
  ) {
    await tryPublishDomainEvent(this.eventPublisher, {
      eventType: 'admissions.application.submitted',
      tenantId: institutionId,
      actorId: applicationId,
      payload: {
        applicationId,
        referenceNumber,
      },
    });
  }

  private async publishAdmissionsStatusChangedEvent(
    applicationId: string,
    status: AdmissionsWorkflowStatus,
    options: WorkflowActor & { rejectionReason?: string; acceptanceLetterUrl?: string },
    institutionId: string | null,
  ) {
    await tryPublishDomainEvent(this.eventPublisher, {
      eventType: 'admissions.status_changed',
      tenantId: institutionId,
      actorId: options.actorEmail ?? null,
      payload: {
        applicationId,
        status,
        rejectionReason: options.rejectionReason ?? null,
        acceptanceLetterUrl: options.acceptanceLetterUrl ?? null,
      },
    });
  }

  private async publishApplicantConvertedEvent(
    applicationId: string,
    studentNumber: string | null,
    options: WorkflowActor,
    institutionId: string | null,
  ) {
    await tryPublishDomainEvent(this.eventPublisher, {
      eventType: 'admissions.applicant_converted',
      tenantId: institutionId,
      actorId: options.actorEmail ?? null,
      payload: {
        applicationId,
        studentNumber,
      },
    });
  }

  private async notifyApplicantStatusUpdate(
    applicationId: string,
    status: AdmissionsWorkflowStatus,
    options: WorkflowActor & { rejectionReason?: string; acceptanceLetterUrl?: string },
  ) {
    if (!this.notificationAdapter) return;

    const { data: applicant } = await this.db
      .from('applicant_profiles')
      .select('email, mobile_number, full_name, reference_number')
      .eq('id', applicationId)
      .maybeSingle();

    const channels: Array<'email' | 'sms'> = [];
    if (applicant?.email) channels.push('email');
    if (applicant?.mobile_number) channels.push('sms');
    if (!channels.length) return;

    try {
      await this.notificationAdapter.sendApplicantStatusUpdate({
        applicationId,
        status,
        applicant: {
          email: applicant.email ?? null,
          mobileNumber: applicant.mobile_number ?? null,
          fullName: applicant.full_name ?? null,
          referenceNumber: applicant.reference_number ?? null,
        },
        channels,
        metadata: {
          actorEmail: options.actorEmail ?? null,
          remarks: options.remarks ?? null,
          rejectionReason: options.rejectionReason ?? null,
          acceptanceLetterUrl: options.acceptanceLetterUrl ?? null,
        },
      });
    } catch {
      // Provider delivery must not roll back the admissions decision.
    }
  }

  private usePostgres(institutionId?: string) {
    return Boolean(
      institutionId?.trim() &&
      process.env.ADMISSIONS_DATABASE_URL?.trim() &&
      process.env.ACADEMICS_DATABASE_URL?.trim(),
    );
  }
}


