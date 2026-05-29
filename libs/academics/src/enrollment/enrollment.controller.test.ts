import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { EnrollmentController } from './enrollment.controller';

let submitted: { studentId: string; classAssignmentIds: string[] } | undefined;
let serviceCalls = 0;
let workflowPayload: unknown;

process.env.JWT_ACCESS_TOKEN_SECRET = 'test-secret-with-enough-length';

function signTestToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_ACCESS_TOKEN_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const studentAuth = [`Bearer ${signTestToken({ sub: 'student-123', role: 'student' })}`, 'student', 'student-123', 'school-a'] as const;

const service = {
  async submit(studentId: string, classAssignmentIds: string[]) {
    serviceCalls += 1;
    submitted = { studentId, classAssignmentIds };
    return { success: true, count: classAssignmentIds.length };
  },
  async addDrop(payload: unknown) {
    serviceCalls += 1;
    workflowPayload = payload;
    return { success: true, status: 'pending_registrar_review' };
  },
  async requestIrregularApproval(payload: unknown) {
    serviceCalls += 1;
    workflowPayload = payload;
    return { success: true, status: 'pending_adviser_review' };
  },
  async approveByRegistrar(payload: unknown) {
    serviceCalls += 1;
    workflowPayload = payload;
    return { success: true, status: 'approved' };
  },
  async confirm(payload: unknown) {
    serviceCalls += 1;
    workflowPayload = payload;
    return { success: true, status: 'confirmed' };
  },
};

async function expectBadRequest(operation: () => Promise<unknown>, expectedMessage: string) {
  await rejects(operation, (error: unknown) => {
    return (
      error instanceof HttpException &&
      error.getStatus() === 400 &&
      error.message === expectedMessage
    );
  });
}

async function run() {
  const controllerPath = Reflect.getMetadata(PATH_METADATA, EnrollmentController);
  const submitPath = Reflect.getMetadata(PATH_METADATA, EnrollmentController.prototype.submit);
  const submitMethod = Reflect.getMetadata(METHOD_METADATA, EnrollmentController.prototype.submit);
  const addDropPath = Reflect.getMetadata(PATH_METADATA, EnrollmentController.prototype.addDrop);
  const irregularPath = Reflect.getMetadata(PATH_METADATA, EnrollmentController.prototype.requestIrregularApproval);
  const registrarPath = Reflect.getMetadata(PATH_METADATA, EnrollmentController.prototype.approveByRegistrar);
  const confirmPath = Reflect.getMetadata(PATH_METADATA, EnrollmentController.prototype.confirm);

  equal(controllerPath, 'enrollment');
  equal(submitPath, 'submit');
  equal(submitMethod, RequestMethod.POST);
  equal(addDropPath, 'add-drop');
  equal(irregularPath, 'irregular-approval');
  equal(registrarPath, 'registrar-approval');
  equal(confirmPath, 'confirm');

  const controller = new EnrollmentController(service as any);
  const payload = { studentId: 'student-123', classAssignmentIds: ['class-a', 'class-b'] };

  const result = await controller.submit(payload, ...studentAuth);
  equal(result.success, true);
  equal(result.count, 2);
  equal(submitted?.studentId, 'student-123');
  equal(submitted?.classAssignmentIds, payload.classAssignmentIds);

  equal((await controller.addDrop({ studentId: 'student-123', dropEnrollmentIds: ['enrollment-1'] }, ...studentAuth)).status, 'pending_registrar_review');
  equal((workflowPayload as any).dropEnrollmentIds[0], 'enrollment-1');
  equal((await controller.requestIrregularApproval({ studentId: 'student-123', classAssignmentIds: ['class-c'], reason: 'Graduating' }, ...studentAuth)).status, 'pending_adviser_review');
  equal((await controller.approveByRegistrar({ requestId: 'request-1', registrarId: 'registrar-1' }, ...studentAuth)).status, 'approved');
  equal((await controller.confirm({ studentId: 'student-123', enrollmentIds: ['enrollment-1'] }, ...studentAuth)).status, 'confirmed');

  await expectBadRequest(
    () => (controller.submit as any)(undefined, ...studentAuth),
    'Missing required fields: studentId and classAssignmentIds',
  );
  await expectBadRequest(
    () => controller.submit({ studentId: 'student-123', classAssignmentIds: [] }, ...studentAuth),
    'Missing required fields: studentId and classAssignmentIds',
  );
  await expectBadRequest(
    () => (controller.submit as any)({ studentId: 'student-123', classAssignmentIds: 'class-a' }, ...studentAuth),
    'Missing required fields: studentId and classAssignmentIds',
  );
  await expectBadRequest(
    () => controller.submit({ studentId: 'student-123', classAssignmentIds: ['class-a', 'class-a'] }, ...studentAuth),
    'Duplicate class selections are not allowed',
  );

  await expectBadRequest(
    () => (controller.addDrop as any)({ studentId: 'student-123' }, ...studentAuth),
    'Add/drop requires at least one class to add or enrollment to drop',
  );
  await expectBadRequest(
    () => (controller.requestIrregularApproval as any)({ studentId: 'student-123', classAssignmentIds: [] }, ...studentAuth),
    'Irregular approval requires studentId, classAssignmentIds, and reason',
  );
  await expectBadRequest(
    () => (controller.approveByRegistrar as any)({ requestId: 'request-1' }, ...studentAuth),
    'Registrar approval requires requestId and registrarId',
  );
  await expectBadRequest(
    () => (controller.confirm as any)({ studentId: 'student-123', enrollmentIds: [] }, ...studentAuth),
    'Enrollment confirmation requires studentId and enrollmentIds',
  );

  equal(serviceCalls, 5);

  await rejects(
    () => controller.submit(payload),
    UnauthorizedException,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
