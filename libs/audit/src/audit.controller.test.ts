import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { RequestMethod, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuditController } from './audit.controller';

process.env.JWT_ACCESS_TOKEN_SECRET = 'test-secret-with-enough-length';

function signTestToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_ACCESS_TOKEN_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const authArgs = [`Bearer ${signTestToken({ sub: 'super-1', role: 'super_admin' })}`, 'super_admin', 'super-1', 'platform'] as const;
let listLimit = 0;
let academicListArgs: any;

const service = {
  async list(limit: number) {
    listLimit = limit;
    return [{ id: 'audit-1', action: 'grade.submitted' }];
  },
};

const academicsRepository = {
  async listAuditEvents(input: any) {
    academicListArgs = input;
    return [{ id: 'academic-audit-1', action: 'grade.submitted' }];
  },
};

async function run() {
  equal(Reflect.getMetadata(PATH_METADATA, AuditController), 'audit');
  equal(Reflect.getMetadata(PATH_METADATA, AuditController.prototype.listEvents), 'events');
  equal(Reflect.getMetadata(METHOD_METADATA, AuditController.prototype.listEvents), RequestMethod.GET);
  equal(Reflect.getMetadata(PATH_METADATA, AuditController.prototype.listAcademicEvents), 'academic-events');
  equal(Reflect.getMetadata(METHOD_METADATA, AuditController.prototype.listAcademicEvents), RequestMethod.GET);

  const controller = new AuditController(service as any) as any;
  controller.academicsRepository = academicsRepository;
  const result = await controller.listEvents('25', ...authArgs);
  equal(result.events.length, 1);
  equal(listLimit, 25);

  const academicResult = await controller.listAcademicEvents('student-1', 'grade.submitted', '5', ...authArgs);
  equal(academicResult.events.length, 1);
  equal(academicListArgs.institutionId, 'platform');
  equal(academicListArgs.studentId, 'student-1');
  equal(academicListArgs.action, 'grade.submitted');
  equal(academicListArgs.limit, 5);

  await rejects(() => controller.listEvents('25'), UnauthorizedException);
  await rejects(
    () => controller.listEvents('25', `Bearer ${signTestToken({ sub: 'admin-1', role: 'alumni_admin' })}`, 'alumni_admin', 'admin-1', 'school-a'),
    ForbiddenException,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
