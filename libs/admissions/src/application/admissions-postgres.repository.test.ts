import { deepEqual, equal, ok } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PostgresAdmissionsRepository } from './admissions-postgres.repository';

type QueryCall = { text: string; values?: unknown[] };

class FakeDb {
  readonly calls: QueryCall[] = [];
  readonly applicants = new Map<string, any>();
  readonly activity: any[] = [];
  readonly academicStudents = new Map<string, any>();

  async query(text: string, values: unknown[] = []) {
    this.calls.push({ text, values });
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.includes('insert into admission_applicants')) {
      const row = {
        id: values[0],
        institution_id: values[1],
        email: values[2],
        school_level: values[3],
        applicant_type: values[4],
        reference_number: values[5],
        status: 'Draft',
      };
      this.applicants.set(String(row.id), row);
      return { rows: [{ id: row.id }] };
    }

    if (normalized.includes('update admission_applicants') && normalized.includes('first_name')) {
      const row = this.applicants.get(String(values[10]));
      Object.assign(row, {
        first_name: values[2],
        last_name: values[3],
        middle_name: values[4],
        full_name: values[5],
        birthdate: values[6],
        mobile_number: values[7],
        address: values[9],
      });
      return { rows: [{ id: row.id }] };
    }

    if (normalized.includes('insert into admission_program_selections')) {
      const row = this.applicants.get(String(values[1]));
      row.program = values[3] ?? values[4] ?? values[2];
      return { rows: [{ applicant_id: values[1] }] };
    }

    if (normalized.includes('update admission_applicants') && normalized.includes('application_submitted_at')) {
      const row = this.applicants.get(String(values[1]));
      row.status = 'Under Review';
      row.application_submitted_at = '2026-05-25T00:00:00.000Z';
      return { rows: [{ reference_number: row.reference_number }] };
    }

    if (normalized.includes('from admission_applicants') && normalized.includes('email = $2') && normalized.includes('reference_number = $3')) {
      const row = [...this.applicants.values()].find((candidate) => (
        candidate.institution_id === values[0] &&
        candidate.email === values[1] &&
        candidate.reference_number === values[2]
      ));
      return { rows: row ? [row] : [] };
    }

    if (normalized.includes('from admission_applicants') && normalized.includes('application_submitted_at is not null')) {
      return { rows: [...this.applicants.values()].filter((row) => row.institution_id === values[0] && row.application_submitted_at) };
    }

    if (normalized.includes('update admission_applicants') && normalized.includes('applicant_number')) {
      const row = this.applicants.get(String(values[3]));
      Object.assign(row, {
        status: values[1],
        applicant_number: values[4],
        reviewed_at: '2026-05-25T00:00:00.000Z',
      });
      return { rows: [{ id: row.id }] };
    }

    if (normalized.includes('insert into admission_activity_logs')) {
      this.activity.push({
        id: `activity-${this.activity.length + 1}`,
        institution_id: values[0],
        applicant_id: values[1],
        event_type: values[2],
        actor_email: values[3],
        metadata: values[4],
      });
      return { rows: [{ id: `activity-${this.activity.length}` }] };
    }

    if (normalized.includes('from admission_applicants') && normalized.includes('id = $2')) {
      const row = this.applicants.get(String(values[1]));
      return { rows: row ? [row] : [] };
    }

    if (normalized.includes('insert into academic_student_accounts')) {
      const row = {
        id: values[1],
        institution_id: values[0],
        email: values[2],
        student_number: values[3],
        applicant_id: values[4],
        full_name: values[5],
        program: values[6],
        year_level: values[7],
      };
      this.academicStudents.set(String(row.id), row);
      return { rows: [{ student_number: row.student_number }] };
    }

    if (normalized.includes('is_enrolled = true')) {
      const row = this.applicants.get(String(values[1]));
      row.is_enrolled = true;
      return { rows: [{ id: row.id }] };
    }

    return { rows: [] };
  }
}

async function main() {
  const db = new FakeDb();
  const repository = new PostgresAdmissionsRepository(db as any, db as any);
  const institutionId = '10000000-0000-0000-0000-000000000001';

  const created = await repository.createApplicantProfile({
    institutionId,
    email: 'applicant+db@example.edu',
    schoolLevel: 'College',
    applicantType: 'New Student',
    referenceSeed: 'APP-20260525-0001',
  });
  ok(created.data?.id);

  await repository.saveApplicantProfile({
    institutionId,
    applicantId: created.data!.id,
    firstName: 'Cloud',
    lastName: 'Applicant',
    middleName: 'SQL',
    birthdate: '2008-01-01',
    mobileNumber: '+639001112222',
    address: 'Sandbox',
  });
  await repository.saveProgramSelection({
    institutionId,
    applicantId: created.data!.id,
    schoolLevel: 'College',
    collegeProgram: 'BSIT',
  });

  const submitted = await repository.submitApplication(institutionId, created.data!.id);
  equal(submitted.data?.reference_number, 'APP-20260525-0001');

  const status = await repository.fetchApplicationStatus(institutionId, 'applicant+db@example.edu', 'APP-20260525-0001');
  equal(status.data?.application.status, 'Under Review');

  const listed = await repository.fetchAdminApplications(institutionId);
  equal(listed.data?.length, 1);

  const decision = await repository.updateAdminApplicationStatus(institutionId, created.data!.id, 'Accepted', {
    actorEmail: 'admissions@demo.itsandbox.site',
    acceptanceLetterUrl: 'https://example.edu/noa.pdf',
  });
  equal(decision.data?.success, true);

  const conversion = await repository.convertAcceptedApplicantToStudent(institutionId, created.data!.id, {
    actorEmail: 'admissions@demo.itsandbox.site',
  });
  equal(conversion.error, null);
  ok(conversion.data?.student_number.startsWith('STU-2026-'));

  deepEqual(db.activity.map((event) => event.event_type), [
    'application_submitted',
    'status_changed',
    'applicant_converted_to_student',
  ]);
  ok(db.calls.some((call) => call.text.includes('academic_student_accounts')));
  ok([...db.academicStudents.values()].some((student) => student.applicant_id === created.data!.id));

  const academicsSchema = readFileSync('prisma/academics/schema.prisma', 'utf8');
  ok(
    academicsSchema.includes('@@unique([institutionId, applicantId]'),
    'academic_student_accounts must have a unique institution/applicant key for admissions conversion upsert',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
