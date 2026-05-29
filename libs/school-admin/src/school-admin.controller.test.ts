import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { equal, throws } from 'node:assert/strict';
import { ForbiddenException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SchoolAdminController } from './school-admin.controller';

process.env.JWT_ACCESS_TOKEN_SECRET = 'test-secret-with-enough-length';

function signTestToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_ACCESS_TOKEN_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const ownerAuth = [
  `Bearer ${signTestToken({ sub: 'owner-1', role: 'school_owner', activeInstitutionId: 'school-a' })}`,
  'school_owner',
  'owner-1',
  'school-a',
  'school-a',
] as const;

async function main() {
  const calls: string[] = [];
  const service = {
    updateProfile: async (...args: unknown[]) => {
      calls.push(`updateProfile:${args[0]}:${args[1]}`);
      return { id: args[0], name: (args[2] as any).name };
    },
    getProfile: async (...args: unknown[]) => {
      calls.push(`getProfile:${args[0]}`);
      return { id: args[0] };
    },
    inviteUser: async (...args: unknown[]) => {
      calls.push(`inviteUser:${args[0]}:${args[1]}`);
      return { id: 'invite-1', ...(args[2] as any) };
    },
    createUser: async (...args: unknown[]) => {
      calls.push(`createUser:${args[0]}:${args[1]}`);
      return { id: 'user-1', ...(args[2] as any) };
    },
    listUsers: async (...args: unknown[]) => {
      calls.push(`listUsers:${args[0]}`);
      return [];
    },
    assignRole: async (...args: unknown[]) => {
      calls.push(`assignRole:${args[0]}:${args[1]}:${args[2]}:${args[3]}`);
      return { id: args[2], role: args[3] };
    },
    setUserStatus: async (...args: unknown[]) => {
      calls.push(`setUserStatus:${args[0]}:${args[1]}:${args[2]}:${args[3]}`);
      return { id: args[2], status: args[3] };
    },
    queuePasswordReset: async (...args: unknown[]) => {
      calls.push(`queuePasswordReset:${args[0]}:${args[1]}:${args[2]}`);
      return { queued: true };
    },
    resendInvite: async (...args: unknown[]) => {
      calls.push(`resendInvite:${args[0]}:${args[1]}:${args[2]}`);
      return { queued: true };
    },
    assignAlumniAdmin: async (...args: unknown[]) => {
      calls.push(`assignAlumniAdmin:${args[0]}:${args[1]}:${args[2]}`);
      return { id: args[2], role: 'alumni_admin' };
    },
    createAcademicRecord: async (...args: unknown[]) => {
      calls.push(`createAcademicRecord:${args[0]}:${args[1]}:${args[2]}`);
      return { id: 'record-1', resourceType: args[2] };
    },
    listAcademicRecords: async (...args: unknown[]) => {
      calls.push(`listAcademicRecords:${args[0]}:${args[1]}`);
      return [];
    },
    updateAcademicRecord: async (...args: unknown[]) => {
      calls.push(`updateAcademicRecord:${args[0]}:${args[1]}:${args[2]}:${args[3]}`);
      return { id: args[3], resourceType: args[2] };
    },
    deleteAcademicRecord: async (...args: unknown[]) => {
      calls.push(`deleteAcademicRecord:${args[0]}:${args[1]}:${args[2]}:${args[3]}`);
      return { id: args[3], deleted: true };
    },
    importAcademicRecords: async (...args: unknown[]) => {
      calls.push(`importAcademicRecords:${args[0]}:${args[1]}:${args[2]}`);
      return { imported: 1 };
    },
    exportAcademicRecords: async (...args: unknown[]) => {
      calls.push(`exportAcademicRecords:${args[0]}:${args[1]}`);
      return { records: [] };
    },
  };

  equal(Reflect.getMetadata(PATH_METADATA, SchoolAdminController), 'school-admin');
  equal(Reflect.getMetadata(PATH_METADATA, SchoolAdminController.prototype.updateProfile), 'settings/profile');
  equal(Reflect.getMetadata(METHOD_METADATA, SchoolAdminController.prototype.updateProfile), RequestMethod.PATCH);
  equal(Reflect.getMetadata(PATH_METADATA, SchoolAdminController.prototype.inviteUser), 'users/invite');
  equal(Reflect.getMetadata(METHOD_METADATA, SchoolAdminController.prototype.inviteUser), RequestMethod.POST);
  equal(Reflect.getMetadata(PATH_METADATA, SchoolAdminController.prototype.createAcademicRecord), 'academic/:resource');
  equal(Reflect.getMetadata(METHOD_METADATA, SchoolAdminController.prototype.createAcademicRecord), RequestMethod.POST);
  equal(Reflect.getMetadata(PATH_METADATA, SchoolAdminController.prototype.importAcademicRecords), 'imports/:resource');
  equal(Reflect.getMetadata(METHOD_METADATA, SchoolAdminController.prototype.importAcademicRecords), RequestMethod.POST);

  const controller = new SchoolAdminController(service as any);

  equal((await controller.updateProfile({ name: 'School A' }, ...ownerAuth)).name, 'School A');
  equal((await controller.inviteUser({ email: 'prof@school.test', role: 'professor' }, ...ownerAuth) as any).role, 'professor');
  equal((await controller.createAcademicRecord('subjects', { code: 'IT101' }, ...ownerAuth)).resourceType, 'subjects');
  equal((await controller.assignRole('user-1', 'registrar', ...ownerAuth) as any).role, 'registrar');
  equal((await controller.setUserStatus('user-1', 'inactive', ...ownerAuth) as any).status, 'inactive');
  equal((await controller.queuePasswordReset('user-1', ...ownerAuth)).queued, true);
  equal((await controller.importAcademicRecords('subjects', [{ code: 'IT102' }], ...ownerAuth)).imported, 1);

  throws(
    () => controller.listUsers(undefined, undefined, `Bearer ${signTestToken({ sub: 'student-1', role: 'student', activeInstitutionId: 'school-a' })}`, 'student', 'student-1', 'school-a', 'school-a'),
    ForbiddenException,
  );

  equal(calls.includes('updateProfile:school-a:owner-1'), true);
  equal(calls.includes('inviteUser:school-a:owner-1'), true);
  equal(calls.includes('createAcademicRecord:school-a:owner-1:subjects'), true);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
