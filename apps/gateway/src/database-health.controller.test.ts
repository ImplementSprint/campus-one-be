import { equal, rejects } from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DatabaseHealthController } from './database-health.controller';
import type { DatabaseHealthReport, DatabaseHealthService } from './database-health.service';

function signTestToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_ACCESS_TOKEN_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

async function run() {
  process.env.JWT_ACCESS_TOKEN_SECRET = 'test-secret-with-enough-length';

  const report: DatabaseHealthReport = {
    status: 'ok',
    service: 'campus-one-backend',
    check: 'database',
    databases: [],
  };

  const service = {
    checkDatabases: async () => report,
  } satisfies Pick<DatabaseHealthService, 'checkDatabases'>;

  const controller = new DatabaseHealthController(service as DatabaseHealthService);
  const superAdminToken = signTestToken({ sub: 'super-admin-1', role: 'super_admin' });
  const studentToken = signTestToken({ sub: 'student-1', role: 'student' });

  equal(
    await controller.checkDatabases(
      `Bearer ${superAdminToken}`,
      'super_admin',
      'super-admin-1',
      undefined,
      undefined,
    ),
    report,
  );

  await rejects(
    () => controller.checkDatabases(undefined, 'super_admin', 'super-admin-1', undefined, undefined),
    UnauthorizedException,
  );

  await rejects(
    () => controller.checkDatabases(`Bearer ${studentToken}`, 'student', 'student-1', undefined, undefined),
    ForbiddenException,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
