import 'reflect-metadata';
import { equal, throws } from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ForbiddenException, RequestMethod, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PlatformSchoolOnboardingController } from './platform-school-onboarding.controller';

process.env.JWT_ACCESS_TOKEN_SECRET = 'test-secret-with-enough-length';

function signTestToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_ACCESS_TOKEN_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const superAdminAuth = [
  `Bearer ${signTestToken({ sub: 'super-1', email: 'superadmin@demo.itsandbox.site', role: 'super_admin' })}`,
  'super_admin',
  'super-1',
] as const;

const schoolOwnerAuth = [
  `Bearer ${signTestToken({ sub: 'owner-1', email: 'owner@demo.itsandbox.site', role: 'school_owner', activeInstitutionId: 'school-1' })}`,
  'school_owner',
  'owner-1',
] as const;

async function run() {
  equal(Reflect.getMetadata(PATH_METADATA, PlatformSchoolOnboardingController), 'platform/schools');
  equal(Reflect.getMetadata(PATH_METADATA, PlatformSchoolOnboardingController.prototype.registerSchool), 'register');
  equal(Reflect.getMetadata(METHOD_METADATA, PlatformSchoolOnboardingController.prototype.registerSchool), RequestMethod.POST);
  equal(Reflect.getMetadata(PATH_METADATA, PlatformSchoolOnboardingController.prototype.approveSchool), ':id/approve');
  equal(Reflect.getMetadata(METHOD_METADATA, PlatformSchoolOnboardingController.prototype.approveSchool), RequestMethod.PATCH);

  let approvedInput: any;
  const service = {
    listSchools: async () => ({ schools: [] }),
    getSchool: async (id: string) => ({ school: { schoolId: id } }),
    registerSchool: async (body: any) => ({ school: { name: body.name } }),
    activateOwner: async () => ({ ownerInvitationStatus: 'accepted' }),
    approveSchool: async (_id: string, input: any) => {
      approvedInput = input;
      return { school: { status: 'approved' } };
    },
    rejectSchool: async () => ({ school: { status: 'rejected' } }),
    suspendSchool: async () => ({ school: { status: 'suspended' } }),
    reactivateSchool: async () => ({ school: { status: 'approved' } }),
  };

  const controller = new PlatformSchoolOnboardingController(service as any);
  const registration = await controller.registerSchool({ name: 'Public School' } as any) as any;
  equal(registration.school.name, 'Public School');

  throws(() => (controller as any).listSchools(), UnauthorizedException);
  throws(() => (controller as any).approveSchool('school-1', { approverId: 'spoofed' }), UnauthorizedException);
  throws(
    () => (controller as any).approveSchool('school-1', { approverId: 'owner-1' }, ...schoolOwnerAuth),
    ForbiddenException,
  );

  const approved = await (controller as any).approveSchool(
    'school-1',
    { approverId: 'spoofed', approverEmail: 'spoofed@example.test' },
    ...superAdminAuth,
  );
  equal(approved.school.status, 'approved');
  equal(approvedInput.approverId, 'super-1');
  equal(approvedInput.approverEmail, 'superadmin@demo.itsandbox.site');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
