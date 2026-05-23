import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/gateway/src/app.module';

type MatrixCase = {
  name: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  expectedStatus: number;
};

process.env.CAMPUS_ONE_AUTH_SECRET ||= 'route-security-secret-local';

function signMatrixToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.CAMPUS_ONE_AUTH_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const alumniAdminHeaders = {
  Authorization: `Bearer ${signMatrixToken({ sub: 'admin-1', role: 'alumni_admin', activeInstitutionId: 'school-a' })}`,
  'X-User-Id': 'admin-1',
  'X-User-Role': 'alumni_admin',
  'X-Institution-Id': 'school-a',
};

const professorHeaders = {
  Authorization: `Bearer ${signMatrixToken({ sub: 'professor-123', role: 'professor', activeInstitutionId: 'school-a' })}`,
  'X-User-Id': 'professor-123',
  'X-User-Role': 'professor',
  'X-Institution-Id': 'school-a',
};

const studentHeaders = {
  Authorization: `Bearer ${signMatrixToken({ sub: 'student-1', role: 'student', activeInstitutionId: 'school-a' })}`,
  'X-User-Id': 'student-1',
  'X-User-Role': 'student',
  'X-Institution-Id': 'school-a',
};

const routeSecurityCases: MatrixCase[] = [
  { name: 'backend health is explicitly anonymous', path: '/api/health', expectedStatus: 200 },
  { name: 'application health is explicitly anonymous', path: '/api/application/health', expectedStatus: 200 },
  { name: 'alumni health is explicitly anonymous', path: '/api/alumni/health', expectedStatus: 200 },
  { name: 'current profile rejects anonymous request', path: '/api/profile/me', expectedStatus: 401 },
  { name: 'profile update rejects anonymous request', path: '/api/profile/me', method: 'PUT', body: { first_name: 'Test' }, expectedStatus: 401 },
  { name: 'current tenant rejects unresolved context', path: '/api/tenant/current', expectedStatus: 401 },
  { name: 'professor route rejects anonymous access', path: '/api/professor/professor-123/classes', expectedStatus: 401 },
  { name: 'professor route rejects wrong role', path: '/api/professor/professor-123/classes', headers: { Authorization: `Bearer ${signMatrixToken({ sub: 'student-1', role: 'student' })}`, 'X-User-Id': 'student-1', 'X-User-Role': 'student' }, expectedStatus: 403 },
  { name: 'professor route rejects wrong tenant', path: '/api/professor/professor-123/classes', headers: { ...professorHeaders, 'X-Institution-Id': 'school-b' }, expectedStatus: 403 },
  { name: 'enrollment submit rejects wrong tenant', path: '/api/enrollment/submit', method: 'POST', headers: { ...studentHeaders, 'X-Institution-Id': 'school-b' }, body: { studentId: 'student-1', classAssignmentIds: ['class-a'] }, expectedStatus: 403 },
  { name: 'student grade summary rejects wrong tenant', path: '/api/grades/student-1/summary', headers: { ...studentHeaders, 'X-Institution-Id': 'school-b' }, expectedStatus: 403 },
  { name: 'professor write validates identity boundary inputs', path: '/api/professor/%20/classes/class-123/announcements', method: 'POST', headers: professorHeaders, body: { title: 'Notice', content: 'Body' }, expectedStatus: 400 },
  { name: 'grade submit validates identity boundary inputs', path: '/api/grades/professor/submit', method: 'POST', headers: professorHeaders, body: { professorId: 'professor-123' }, expectedStatus: 400 },
  { name: 'alumni admin requests reject anonymous access', path: '/api/alumni/admin/requests', expectedStatus: 401 },
  { name: 'alumni admin requests reject wrong role', path: '/api/alumni/admin/requests', headers: { Authorization: `Bearer ${signMatrixToken({ sub: 'student-1', role: 'student' })}`, 'X-User-Id': 'student-1', 'X-User-Role': 'student' }, expectedStatus: 403 },
  { name: 'alumni admin requests reject wrong tenant', path: '/api/alumni/admin/requests', headers: { ...alumniAdminHeaders, 'X-Institution-Id': 'school-b' }, expectedStatus: 403 },
  { name: 'audit events reject anonymous access', path: '/api/audit/events', expectedStatus: 401 },
  { name: 'audit events reject non-super-admin role', path: '/api/audit/events', headers: alumniAdminHeaders, expectedStatus: 403 },
  { name: 'alumni fulfillment validates status transition payload', path: '/api/alumni/admin/requests/request-123', method: 'PATCH', headers: alumniAdminHeaders, body: { status_code: 200, payment_status: 'settled' }, expectedStatus: 400 },
  { name: 'alumni card fulfillment validates status transition payload', path: '/api/alumni/admin/card-requests/card-123', method: 'PATCH', headers: alumniAdminHeaders, body: { status_code: 300, payment_status: 'settled' }, expectedStatus: 400 },
  { name: 'notifications validate target profile', path: '/api/notifications/%20', expectedStatus: 400 },
];

async function runMatrix() {
  console.log('Starting route security matrix...');
  const app = await NestFactory.create(AppModule, { abortOnError: false, logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');

  try {
    const url = await app.getUrl();
    for (const matrixCase of routeSecurityCases) {
      const response = await fetch(`${url}${matrixCase.path}`, {
        method: matrixCase.method ?? 'GET',
        headers: {
          ...(matrixCase.body ? { 'Content-Type': 'application/json' } : {}),
          ...(matrixCase.headers ?? {}),
        },
        body: matrixCase.body ? JSON.stringify(matrixCase.body) : undefined,
      });

      if (response.status !== matrixCase.expectedStatus) {
        const body = await response.text().catch(() => '');
        throw new Error(`${matrixCase.name}: expected ${matrixCase.expectedStatus}, received ${response.status}. ${body}`);
      }

      console.log(`ok - ${matrixCase.name}`);
    }
  } finally {
    await app.close();
  }
}

runMatrix().catch((error) => {
  console.error(error);
  process.exit(1);
});
