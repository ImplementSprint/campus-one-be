import { deepEqual, equal, rejects } from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  SchoolAdminService,
  type SchoolAdminRepository,
  type SchoolAdminRecord,
} from './school-admin.service';

class MemorySchoolAdminRepository implements SchoolAdminRepository {
  readonly profiles = new Map<string, Record<string, unknown>>();
  readonly records = new Map<string, SchoolAdminRecord>();
  readonly audits: Array<Record<string, unknown>> = [];
  readonly deliveries: Array<Record<string, unknown>> = [];

  async getProfile(institutionId: string) {
    return this.profiles.get(institutionId) ?? null;
  }

  async upsertProfile(institutionId: string, payload: Record<string, unknown>) {
    const profile = { id: institutionId, ...(this.profiles.get(institutionId) ?? {}), ...payload };
    this.profiles.set(institutionId, profile);
    return profile;
  }

  async listRecords(institutionId: string, resourceType: string, filters?: Record<string, string>) {
    return Array.from(this.records.values()).filter((record) => {
      if (record.institutionId !== institutionId || record.resourceType !== resourceType) return false;
      return Object.entries(filters ?? {}).every(([key, value]) => record.data[key] === value);
    });
  }

  async getRecord(institutionId: string, resourceType: string, id: string) {
    const record = this.records.get(id);
    if (!record || record.institutionId !== institutionId || record.resourceType !== resourceType) return null;
    return record;
  }

  async upsertRecord(record: SchoolAdminRecord) {
    this.records.set(record.id, record);
    return record;
  }

  async deleteRecord(institutionId: string, resourceType: string, id: string) {
    const record = await this.getRecord(institutionId, resourceType, id);
    if (!record) return false;
    this.records.delete(id);
    return true;
  }

  async recordAudit(input: Record<string, unknown>) {
    this.audits.push(input);
    return { recorded: true };
  }

  async queueDelivery(input: Record<string, unknown>) {
    this.deliveries.push(input);
    return { queued: true, channel: input.channel };
  }
}

async function main() {
  const repository = new MemorySchoolAdminRepository();
  const service = new SchoolAdminService(repository);

  const profile = await service.updateProfile('school-a', 'owner-1', {
    name: 'Campus One University',
    logoUrl: 'https://cdn.example/logo.png',
    theme: { primaryColor: '#1946b8', accentColor: '#f4b400' },
    academicCalendar: { schoolYear: '2026-2027' },
    enrollmentPeriod: { startDate: '2026-06-01', endDate: '2026-06-30' },
    admissionsPeriod: { startDate: '2026-01-01', endDate: '2026-03-30' },
    gradingScale: [{ label: 'A', min: 90 }],
  });

  equal(profile.id, 'school-a');
  deepEqual((profile as any).theme, { primaryColor: '#1946b8', accentColor: '#f4b400' });
  equal(repository.audits[0].action, 'school_admin.profile.updated');

  const invite = await service.inviteUser('school-a', 'owner-1', {
    email: 'Professor@School.test',
    role: 'professor',
    displayName: 'Prof One',
  });

  equal((invite as any).email, 'professor@school.test');
  equal((invite as any).status, 'pending');
  equal(repository.deliveries[0].template, 'school_user_invitation');
  equal(repository.audits[1].action, 'school_admin.user.invited');

  const admin = await service.createUser('school-a', 'owner-1', {
    email: 'admin@school.test',
    role: 'school_admin',
    displayName: 'School Admin',
  });
  equal((admin as any).role, 'school_admin');

  const roleChange = await service.assignRole('school-a', 'owner-1', admin.id, 'alumni_admin');
  equal((roleChange as any).role, 'alumni_admin');

  const disabled = await service.setUserStatus('school-a', 'owner-1', admin.id, 'inactive');
  equal((disabled as any).status, 'inactive');

  const reset = await service.queuePasswordReset('school-a', 'owner-1', admin.id);
  equal(reset.queued, true);
  equal(repository.deliveries.at(-1)?.template, 'school_user_password_reset');

  const users = await service.listUsers('school-a', { role: 'alumni_admin', status: 'inactive' });
  equal(users.length, 1);
  equal(users[0].id, admin.id);

  const department = await service.createAcademicRecord('school-a', 'owner-1', 'departments', {
    code: 'CCS',
    name: 'College of Computer Studies',
  });
  equal(department.institutionId, 'school-a');
  equal(department.resourceType, 'departments');

  const program = await service.createAcademicRecord('school-a', 'owner-1', 'programs', {
    code: 'BSIT',
    name: 'BS Information Technology',
    departmentId: department.id,
  });
  equal(program.data.departmentId, department.id);

  const subject = await service.createAcademicRecord('school-a', 'owner-1', 'subjects', {
    code: 'IT101',
    title: 'Introduction to Computing',
    units: 3,
  });
  const section = await service.createAcademicRecord('school-a', 'owner-1', 'sections', {
    code: 'BSIT-1A',
    programId: program.id,
  });
  const room = await service.createAcademicRecord('school-a', 'owner-1', 'rooms', {
    code: 'R101',
    capacity: 35,
  });
  const term = await service.createAcademicRecord('school-a', 'owner-1', 'terms', {
    schoolYear: '2026-2027',
    term: '1st Semester',
  });
  const classAssignment = await service.createAcademicRecord('school-a', 'owner-1', 'class-assignments', {
    subjectId: subject.id,
    sectionId: section.id,
    roomId: room.id,
    termId: term.id,
    professorId: 'professor-1',
    schedule: 'MWF 09:00-10:00',
  });
  equal(classAssignment.data.professorId, 'professor-1');

  const exported = await service.exportAcademicRecords('school-a', 'class-assignments');
  equal(exported.records.length, 1);

  const importResult = await service.importAcademicRecords('school-a', 'owner-1', 'subjects', [
    { code: 'IT102', title: 'Computer Programming', units: 3 },
  ]);
  equal(importResult.imported, 1);

  await rejects(
    () => service.createAcademicRecord('school-a', 'owner-1', 'unsupported', { name: 'Nope' }),
    BadRequestException,
  );
  await rejects(
    () => service.assignRole('school-a', 'owner-1', 'missing-user', 'professor'),
    NotFoundException,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
