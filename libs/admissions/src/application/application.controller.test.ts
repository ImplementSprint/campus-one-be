import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ApplicationController } from './application.controller';

let serviceCalls = 0;
let trackPayload: { email: string; referenceNumber: string } | undefined;
let statusPayload: { email: string; referenceNumber: string } | undefined;
let accessPayload: { email: string; referenceNumber: string } | undefined;
let createPayload: { email: string; institutionId?: string } | undefined;
let submitPayload: { applicantId: string; institutionId?: string } | undefined;
let adminStatusPayload:
  | { applicationId: string; status: string; options?: { rejectionReason?: string; acceptanceLetterUrl?: string }; institutionId?: string }
  | undefined;
let adminProgramPayload:
  | { applicationId: string; department: string; program: string; institutionId?: string }
  | undefined;

const service = {
  createApplicantProfile(dto: any, institutionId?: string) {
    serviceCalls += 1;
    createPayload = { email: dto.email, institutionId };
    return { success: true, id: 'app-1' };
  },
  submitApplication(applicantId: string, institutionId?: string) {
    serviceCalls += 1;
    submitPayload = { applicantId, institutionId };
    return { success: true, reference_number: 'APP-1' };
  },
  trackApplication(email: string, referenceNumber: string) {
    serviceCalls += 1;
    trackPayload = { email, referenceNumber };
    return { success: true, action: 'tracked' };
  },
  fetchApplicationStatus(email: string, referenceNumber: string) {
    serviceCalls += 1;
    statusPayload = { email, referenceNumber };
    return { success: true, status: 'Under Review' };
  },
  validateApplicationAccess(email: string, referenceNumber: string) {
    serviceCalls += 1;
    accessPayload = { email, referenceNumber };
    return { success: true, allowed: true };
  },
  updateAdminApplicationStatus(applicationId: string, status: string, options?: { rejectionReason?: string; acceptanceLetterUrl?: string }, institutionId?: string) {
    serviceCalls += 1;
    adminStatusPayload = { applicationId, status, options, institutionId };
    return { success: true, status };
  },
  updateAdminProgramSelection(applicationId: string, department: string, program: string, institutionId?: string) {
    serviceCalls += 1;
    adminProgramPayload = { applicationId, department, program, institutionId };
    return { success: true, department, program };
  },
};

async function expectBadRequest(operation: () => unknown, expectedMessage: string) {
  await rejects(async () => operation(), (error: unknown) => {
    return (
      error instanceof BadRequestException &&
      error.getStatus() === 400 &&
      error.message === expectedMessage
    );
  });
}

async function run() {
  const controllerPath = Reflect.getMetadata(PATH_METADATA, ApplicationController);
  const trackPath = Reflect.getMetadata(PATH_METADATA, ApplicationController.prototype.trackApplication);
  const trackMethod = Reflect.getMetadata(METHOD_METADATA, ApplicationController.prototype.trackApplication);
  const statusPath = Reflect.getMetadata(PATH_METADATA, ApplicationController.prototype.fetchApplicationStatus);
  const statusMethod = Reflect.getMetadata(METHOD_METADATA, ApplicationController.prototype.fetchApplicationStatus);
  const accessPath = Reflect.getMetadata(PATH_METADATA, ApplicationController.prototype.validateApplicationAccess);
  const accessMethod = Reflect.getMetadata(METHOD_METADATA, ApplicationController.prototype.validateApplicationAccess);
  const adminStatusPath = Reflect.getMetadata(PATH_METADATA, ApplicationController.prototype.updateAdminApplicationStatus);
  const adminStatusMethod = Reflect.getMetadata(METHOD_METADATA, ApplicationController.prototype.updateAdminApplicationStatus);
  const adminProgramPath = Reflect.getMetadata(PATH_METADATA, ApplicationController.prototype.updateAdminProgramSelection);
  const adminProgramMethod = Reflect.getMetadata(METHOD_METADATA, ApplicationController.prototype.updateAdminProgramSelection);

  equal(controllerPath, 'application');
  equal(trackPath, 'track');
  equal(trackMethod, RequestMethod.POST);
  equal(statusPath, 'status');
  equal(statusMethod, RequestMethod.GET);
  equal(accessPath, 'validate-access');
  equal(accessMethod, RequestMethod.GET);
  equal(adminStatusPath, 'admin/applications/:applicationId/status');
  equal(adminStatusMethod, RequestMethod.PUT);
  equal(adminProgramPath, 'admin/applications/:applicationId/program-selection');
  equal(adminProgramMethod, RequestMethod.PUT);

  const controller = new ApplicationController(service as any);

  const createResult = controller.createApplicantProfile({ email: 'applicant@example.com' }, 'school-a');
  equal((createResult as any).id, 'app-1');
  equal(createPayload?.institutionId, 'school-a');

  const submitResult = controller.submitApplication('app-1', 'school-a');
  equal((submitResult as any).reference_number, 'APP-1');
  equal(submitPayload?.institutionId, 'school-a');

  const trackResult = controller.trackApplication({ email: 'applicant@example.com', referenceNumber: 'APP-123' });
  equal((trackResult as any).action, 'tracked');
  equal(trackPayload?.email, 'applicant@example.com');
  equal(trackPayload?.referenceNumber, 'APP-123');

  const statusResult = controller.fetchApplicationStatus('applicant@example.com', 'APP-123');
  equal((statusResult as any).status, 'Under Review');
  equal(statusPayload?.email, 'applicant@example.com');
  equal(statusPayload?.referenceNumber, 'APP-123');

  const accessResult = controller.validateApplicationAccess('applicant@example.com', 'APP-123');
  equal((accessResult as any).allowed, true);
  equal(accessPayload?.email, 'applicant@example.com');
  equal(accessPayload?.referenceNumber, 'APP-123');

  const adminStatusResult = controller.updateAdminApplicationStatus('application-123', {
    status: 'Not Accepted',
    rejectionReason: 'Incomplete requirements',
  }, 'school-a');
  equal((adminStatusResult as any).status, 'Not Accepted');
  equal(adminStatusPayload?.applicationId, 'application-123');
  equal(adminStatusPayload?.status, 'Not Accepted');
  equal(adminStatusPayload?.options?.rejectionReason, 'Incomplete requirements');
  equal(adminStatusPayload?.institutionId, 'school-a');

  const adminProgramResult = controller.updateAdminProgramSelection('application-123', {
    department: 'Engineering',
    program: 'BS Computer Engineering',
  }, 'school-a');
  equal((adminProgramResult as any).program, 'BS Computer Engineering');
  equal(adminProgramPayload?.applicationId, 'application-123');
  equal(adminProgramPayload?.department, 'Engineering');
  equal(adminProgramPayload?.program, 'BS Computer Engineering');
  equal(adminProgramPayload?.institutionId, 'school-a');

  await expectBadRequest(
    () => controller.trackApplication({ email: ' ', referenceNumber: 'APP-123' }),
    'Email and referenceNumber are required',
  );
  await expectBadRequest(
    () => controller.fetchApplicationStatus('applicant@example.com', ' '),
    'Email and referenceNumber are required',
  );
  await expectBadRequest(
    () => controller.validateApplicationAccess('', 'APP-123'),
    'Email and referenceNumber are required',
  );
  await expectBadRequest(
    () => controller.updateAdminApplicationStatus(' ', { status: 'Under Review' }),
    'applicationId is required',
  );
  await expectBadRequest(
    () => (controller.updateAdminApplicationStatus as any)('application-123', { status: 'Denied' }),
    'Invalid application status',
  );
  await expectBadRequest(
    () => controller.updateAdminApplicationStatus('application-123', { status: 'Not Accepted' }),
    'rejectionReason is required when status is rejected',
  );
  await expectBadRequest(
    () => controller.updateAdminProgramSelection('application-123', { department: ' ', program: 'BSIT' }),
    'applicationId, department, and program are required',
  );

  equal(serviceCalls, 7);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
