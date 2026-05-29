import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AdmissionsWorkflowStatus } from './application.service';

type QueryResult<T = any> = { rows: T[]; rowCount?: number };
type Queryable = { query<T = any>(text: string, values?: unknown[]): Promise<QueryResult<T>> };
type ServiceResponse<T> = { data: T | null; error: { message: string; code?: string } | null };
type WorkflowActor = { actorEmail?: string; remarks?: string; rejectionReason?: string; acceptanceLetterUrl?: string };

export type CreateApplicantProfileInput = {
  institutionId: string;
  email: string;
  schoolLevel?: string;
  applicantType?: string;
  referenceSeed?: string;
};

export type SaveApplicantProfileInput = {
  institutionId: string;
  applicantId: string;
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
  birthdate?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
  schoolLevel?: string | null;
  applicantType?: string | null;
};

export type SaveProgramSelectionInput = {
  institutionId: string;
  applicantId: string;
  schoolLevel?: string | null;
  collegeProgram?: string | null;
  collegeDepartment?: string | null;
  seniorHighTrack?: string | null;
};

export class PostgresAdmissionsRepository {
  private admissionsPool?: Queryable;
  private academicsPool?: Queryable;

  constructor(
    private readonly admissionsQueryable?: Queryable,
    private readonly academicsQueryable?: Queryable,
  ) {}

  async createApplicantProfile(input: CreateApplicantProfileInput): Promise<ServiceResponse<{ id: string }>> {
    const applicantId = randomUUID();
    const referenceNumber = input.referenceSeed ?? this.createReferenceNumber();
    const result = await this.queryAdmissions(
      `
        insert into admission_applicants (
          id,
          institution_id,
          email,
          school_level,
          applicant_type,
          reference_number,
          status,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, 'Draft', now(), now())
        returning id
      `,
      [
        applicantId,
        input.institutionId,
        input.email,
        input.schoolLevel ?? null,
        input.applicantType ?? null,
        referenceNumber,
      ],
    );

    return { data: { id: result.rows[0]?.id ?? applicantId }, error: null };
  }

  async saveApplicantProfile(input: SaveApplicantProfileInput): Promise<ServiceResponse<{ id: string }>> {
    const firstName = input.firstName ?? '';
    const lastName = input.lastName ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    await this.queryAdmissions(
      `
        update admission_applicants
        set school_level = coalesce($1, school_level),
            applicant_type = coalesce($2, applicant_type),
            first_name = $3,
            last_name = $4,
            middle_name = $5,
            full_name = $6,
            birthdate = $7,
            mobile_number = $8,
            address = $10,
            updated_at = now()
        where institution_id = $9
          and id = $11
      `,
      [
        input.schoolLevel ?? null,
        input.applicantType ?? null,
        firstName,
        lastName,
        input.middleName ?? null,
        fullName,
        input.birthdate ?? null,
        input.mobileNumber ?? null,
        input.institutionId,
        input.address ?? null,
        input.applicantId,
      ],
    );
    return { data: { id: input.applicantId }, error: null };
  }

  async saveProgramSelection(input: SaveProgramSelectionInput): Promise<ServiceResponse<{ id: string }>> {
    await this.queryAdmissions(
      `
        insert into admission_program_selections (
          institution_id,
          applicant_id,
          school_level,
          college_program,
          college_department,
          senior_high_track,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, now())
        on conflict (id) do update
          set school_level = excluded.school_level,
              college_program = excluded.college_program,
              college_department = excluded.college_department,
              senior_high_track = excluded.senior_high_track,
              updated_at = now()
        returning applicant_id
      `,
      [
        input.institutionId,
        input.applicantId,
        input.schoolLevel ?? null,
        input.collegeProgram ?? null,
        input.collegeDepartment ?? null,
        input.seniorHighTrack ?? null,
      ],
    );

    const program = input.collegeProgram ?? input.seniorHighTrack ?? input.schoolLevel ?? null;
    if (program) {
      await this.queryAdmissions(
        `
          update admission_applicants
          set program = $1,
              updated_at = now()
          where institution_id = $2
            and id = $3
        `,
        [program, input.institutionId, input.applicantId],
      );
    }

    return { data: { id: input.applicantId }, error: null };
  }

  async submitApplication(institutionId: string, applicantId: string): Promise<ServiceResponse<{ reference_number: string }>> {
    const result = await this.queryAdmissions(
      `
        update admission_applicants
        set application_submitted_at = now(),
            status = 'Under Review',
            updated_at = now()
        where institution_id = $1
          and id = $2
        returning reference_number
      `,
      [institutionId, applicantId],
    );
    if (!result.rows[0]) return { data: null, error: { message: 'Application not found' } };

    await this.recordAdmissionAudit(institutionId, applicantId, 'application_submitted', {}, {});
    return { data: { reference_number: result.rows[0].reference_number }, error: null };
  }

  async trackApplication(
    institutionId: string,
    email: string,
    referenceNumber: string,
  ): Promise<ServiceResponse<{ id: string }>> {
    const result = await this.findApplicantByEmailAndReference(institutionId, email, referenceNumber);
    const row = result.rows[0];
    if (!row) return { data: null, error: { message: 'Invalid email or reference number' } };
    return { data: { id: row.id }, error: null };
  }

  async fetchApplicationStatus(institutionId: string, email: string, referenceNumber: string): Promise<ServiceResponse<any>> {
    const result = await this.findApplicantByEmailAndReference(institutionId, email, referenceNumber);
    const row = result.rows[0];
    if (!row) return { data: null, error: { message: 'Invalid email or reference number' } };

    return {
      data: {
        application: mapApplicant(row),
        documents: [],
        progress: buildProgress(row),
        remarks: row.rejection_reason ?? null,
      },
      error: null,
    };
  }

  async fetchAdminApplications(institutionId: string): Promise<ServiceResponse<any[]>> {
    const result = await this.queryAdmissions(
      `
        select *
        from admission_applicants
        where institution_id = $1
          and application_submitted_at is not null
        order by application_submitted_at desc
      `,
      [institutionId],
    );
    return { data: result.rows.map(mapApplicant), error: null };
  }

  async fetchAdminApplicationDetail(institutionId: string, applicationId: string): Promise<ServiceResponse<any>> {
    const result = await this.queryAdmissions(
      `
        select a.*, ps.school_level as selected_school_level, ps.college_program, ps.college_department, ps.senior_high_track
        from admission_applicants a
        left join admission_program_selections ps
          on ps.institution_id = a.institution_id
         and ps.applicant_id = a.id
        where a.institution_id = $1
          and a.id = $2
      `,
      [institutionId, applicationId],
    );
    const row = result.rows[0];
    if (!row) return { data: null, error: { message: 'Application not found' } };

    return {
      data: {
        ...mapApplicant(row),
        parent_info: null,
        academic_background: [],
        alumni_relatives: [],
        documents: [],
        program_selection: {
          school_level: row.selected_school_level,
          college_program: row.college_program,
          college_department: row.college_department,
          senior_high_track: row.senior_high_track,
        },
      },
      error: null,
    };
  }

  async updateAdminApplicationStatus(
    institutionId: string,
    applicationId: string,
    status: AdmissionsWorkflowStatus,
    options: WorkflowActor = {},
  ): Promise<ServiceResponse<{ success: boolean }>> {
    const applicantNumber = status === 'Passed' || status === 'Accepted'
      ? this.createApplicantNumber()
      : null;
    const result = await this.queryAdmissions(
      `
        update admission_applicants
        set status = $2,
            reviewed_at = now(),
            rejection_reason = $3,
            applicant_number = coalesce($5, applicant_number),
            acceptance_letter_url = $6,
            updated_at = now()
        where institution_id = $1
          and id = $4
        returning id
      `,
      [
        institutionId,
        status,
        options.rejectionReason ?? null,
        applicationId,
        applicantNumber,
        options.acceptanceLetterUrl ?? null,
      ],
    );
    if (!result.rows[0]) return { data: null, error: { message: 'Application not found' } };

    await this.recordAdmissionAudit(institutionId, applicationId, 'status_changed', options, {
      status,
      rejectionReason: options.rejectionReason ?? null,
      acceptanceLetterUrl: options.acceptanceLetterUrl ?? null,
    });
    return { data: { success: true }, error: null };
  }

  async convertAcceptedApplicantToStudent(
    institutionId: string,
    applicationId: string,
    options: WorkflowActor = {},
  ): Promise<ServiceResponse<{ student_number: string }>> {
    const result = await this.queryAdmissions(
      `
        select id, email, full_name, applicant_number, reference_number, status, program
        from admission_applicants
        where institution_id = $1
          and id = $2
      `,
      [institutionId, applicationId],
    );
    const applicant = result.rows[0];
    if (!applicant) return { data: null, error: { message: 'Application not found' } };
    if (!['Accepted', 'Passed'].includes(applicant.status)) {
      throw new BadRequestException('Only accepted applicants can be converted to students');
    }

    const studentNumber = applicant.applicant_number ?? applicant.reference_number ?? this.createApplicantNumber();
    const studentId = this.createStudentId(applicationId);
    const student = await this.queryAcademics(
      `
        insert into academic_student_accounts (
          institution_id,
          id,
          email,
          student_number,
          applicant_id,
          full_name,
          program,
          year_level,
          status,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, 1, 'active', now(), now())
        on conflict (institution_id, applicant_id) do update
          set email = excluded.email,
              student_number = excluded.student_number,
              full_name = excluded.full_name,
              program = excluded.program,
              status = 'active',
              updated_at = now()
        returning student_number
      `,
      [
        institutionId,
        studentId,
        applicant.email ?? null,
        studentNumber,
        applicationId,
        applicant.full_name ?? null,
        applicant.program ?? null,
      ],
    );

    await this.queryAdmissions(
      `
        update admission_applicants
        set is_enrolled = true,
            enrolled_at = now(),
            updated_at = now()
        where institution_id = $1
          and id = $2
        returning id
      `,
      [institutionId, applicationId],
    );

    await this.recordAdmissionAudit(institutionId, applicationId, 'applicant_converted_to_student', options, {
      studentNumber: student.rows[0]?.student_number ?? studentNumber,
    });
    return { data: { student_number: student.rows[0]?.student_number ?? studentNumber }, error: null };
  }

  private async findApplicantByEmailAndReference(institutionId: string, email: string, referenceNumber: string) {
    return this.queryAdmissions(
      `
        select *
        from admission_applicants
        where institution_id = $1
          and email = $2
          and reference_number = $3
      `,
      [institutionId, email, referenceNumber],
    );
  }

  private async recordAdmissionAudit(
    institutionId: string,
    applicationId: string,
    eventType: string,
    options: WorkflowActor,
    metadata: Record<string, unknown>,
  ) {
    await this.queryAdmissions(
      `
        insert into admission_activity_logs (
          institution_id,
          applicant_id,
          event_type,
          actor_email,
          metadata,
          created_at
        )
        values ($1, $2, $3, $4, $5::jsonb, now())
      `,
      [
        institutionId,
        applicationId,
        eventType,
        options.actorEmail ?? null,
        {
          remarks: options.remarks ?? null,
          ...metadata,
        },
      ],
    );
  }

  private async queryAdmissions<T = any>(text: string, values?: unknown[]) {
    return this.getAdmissionsQueryable().query<T>(text, values);
  }

  private async queryAcademics<T = any>(text: string, values?: unknown[]) {
    return this.getAcademicsQueryable().query<T>(text, values);
  }

  private getAdmissionsQueryable() {
    if (this.admissionsQueryable) return this.admissionsQueryable;
    if (!this.admissionsPool) {
      const connectionString = process.env.ADMISSIONS_DATABASE_URL;
      if (!connectionString?.trim()) throw new Error('ADMISSIONS_DATABASE_URL must be configured.');
      const { Pool } = require('pg');
      this.admissionsPool = new Pool({ connectionString });
    }
    return this.admissionsPool;
  }

  private getAcademicsQueryable() {
    if (this.academicsQueryable) return this.academicsQueryable;
    if (!this.academicsPool) {
      const connectionString = process.env.ACADEMICS_DATABASE_URL;
      if (!connectionString?.trim()) throw new Error('ACADEMICS_DATABASE_URL must be configured.');
      const { Pool } = require('pg');
      this.academicsPool = new Pool({ connectionString });
    }
    return this.academicsPool;
  }

  private createReferenceNumber() {
    const date = new Date();
    return `APP-${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}-${randomUUID().slice(0, 8)}`;
  }

  private createApplicantNumber() {
    const date = new Date();
    return `STU-${date.getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private createStudentId(applicationId?: string) {
    return applicationId ? `student-${applicationId}` : randomUUID();
  }
}

function mapApplicant(row: any) {
  return {
    ...row,
    institutionId: row.institution_id,
    referenceNumber: row.reference_number,
    applicantNumber: row.applicant_number,
    schoolLevel: row.school_level,
    applicantType: row.applicant_type,
    fullName: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name,
    mobileNumber: row.mobile_number,
    applicationSubmittedAt: row.application_submitted_at,
    reviewedAt: row.reviewed_at,
    isEnrolled: Boolean(row.is_enrolled),
  };
}

function buildProgress(row: any) {
  return [
    { step: 1, label: 'Application Submitted', status: row.application_submitted_at ? 'completed' : 'pending', date: row.application_submitted_at },
    {
      step: 2,
      label: 'Under Review',
      status: row.status === 'Under Review' ? 'current' : row.application_submitted_at ? 'completed' : 'pending',
      date: row.application_submitted_at,
    },
    {
      step: 3,
      label: 'Verified by Admin',
      status: ['Passed', 'Accepted', 'Rejected', 'Not Accepted'].includes(row.status) ? 'completed' : 'pending',
      date: row.reviewed_at,
    },
    {
      step: 4,
      label: 'Decision Released',
      status: ['Passed', 'Accepted', 'Rejected', 'Not Accepted'].includes(row.status) ? 'completed' : 'pending',
      date: row.reviewed_at,
    },
  ];
}
