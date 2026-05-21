import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

type ServiceResponse<T> = { data: T | null; error: { message: string; code?: string } | null };

@Injectable()
export class ApplicationService {
  private readonly supabase = createClient(
    process.env.SUPABASE_URL as string,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY) as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  private readonly db = this.supabase.schema('applicant');

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

  async createApplicantProfile(dto: any): Promise<ServiceResponse<{ id: string }>> {
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

  async submitApplication(applicantId: string): Promise<ServiceResponse<{ reference_number: string }>> {
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
    return { data: { reference_number: data.reference_number as string }, error: null };
  }

  async trackApplication(email: string, referenceNumber: string): Promise<ServiceResponse<{ id: string }>> {
    const { data, error } = await this.db
      .from('applicant_profiles')
      .select('id')
      .eq('email', email)
      .eq('reference_number', referenceNumber)
      .single();
    if (error) return { data: null, error: { message: 'Invalid email or reference number' } };
    return { data: { id: data.id as string }, error: null };
  }

  async saveApplicantProfile(dto: any): Promise<ServiceResponse<{ id: string }>> {
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

  async uploadApplicantDocument(dto: any): Promise<ServiceResponse<any>> {
    const timestamp = Date.now();
    const sanitized = dto.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${dto.applicant_id}/${timestamp}_${sanitized}`;
    const fileBuffer = Buffer.from(dto.file_base64, 'base64');

    const { error: storageError } = await this.supabase.storage
      .from('applicant-documents')
      .upload(filePath, fileBuffer, { upsert: true, contentType: dto.file_type || 'application/octet-stream' });
    if (storageError) return { data: null, error: { message: storageError.message } };

    const { data: urlData } = this.supabase.storage.from('applicant-documents').getPublicUrl(filePath);
    const { data, error: dbError } = await this.db
      .from('applicant_documents')
      .insert({
        applicant_id: dto.applicant_id,
        document_name: dto.document_name,
        file_name: dto.file_name,
        file_url: urlData.publicUrl,
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

  async saveProgramSelection(payload: any): Promise<ServiceResponse<{ id: string }>> {
    const { error } = await this.db
      .from('program_selections')
      .upsert(payload, { onConflict: 'applicant_id' });
    if (error) return { data: null, error: { message: error.message } };
    const programName = payload.college_program || payload.senior_high_track || payload.school_level;
    await this.db.from('applicant_profiles').update({ program: programName }).eq('id', payload.applicant_id);
    return { data: { id: payload.applicant_id }, error: null };
  }

  async fetchApplicationStatus(email: string, referenceNumber: string): Promise<ServiceResponse<any>> {
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

  async validateApplicationAccess(email: string, referenceNumber: string): Promise<{
    valid: boolean;
    applicantId: string;
    error?: string;
  }> {
    const { data, error } = await this.db
      .from('applicant_profiles')
      .select('id')
      .eq('email', email)
      .eq('reference_number', referenceNumber)
      .single();
    if (error || !data) return { valid: false, applicantId: '', error: 'Invalid credentials' };
    return { valid: true, applicantId: data.id as string };
  }

  async fetchAdminApplications(): Promise<ServiceResponse<any[]>> {
    const { data, error } = await this.db
      .from('applicant_profiles')
      .select('*')
      .not('application_submitted_at', 'is', null)
      .order('application_submitted_at', { ascending: false });
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data ?? []) as any[], error: null };
  }

  async fetchAdminApplicationDetail(applicationId: string): Promise<ServiceResponse<any>> {
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

  async updateAdminApplicationStatus(
    applicationId: string,
    status: 'Under Review' | 'Passed' | 'Not Accepted',
    rejectionReason?: string,
  ): Promise<ServiceResponse<{ success: boolean }>> {
    const updateData: Record<string, unknown> = {
      status,
      reviewed_at: new Date().toISOString(),
    };

    if (status === 'Passed') {
      const { data: appNumber } = await this.db.rpc('generate_applicant_number');
      updateData.applicant_number = appNumber;
    }

    if (status === 'Not Accepted' && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { error } = await this.db.from('applicant_profiles').update(updateData).eq('id', applicationId);
    if (error) return { data: null, error: { message: error.message } };
    return { data: { success: true }, error: null };
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
        accepted: rows.filter((app: any) => app.status === 'Passed').length,
        rejected: rows.filter((app: any) => app.status === 'Not Accepted').length,
      },
      error: null,
    };
  }

  async updateAdminProgramSelection(
    applicationId: string,
    department: string,
    program: string,
  ): Promise<ServiceResponse<{ success: boolean }>> {
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
}


