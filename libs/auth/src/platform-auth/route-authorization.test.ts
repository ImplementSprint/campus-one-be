import 'reflect-metadata';
import { equal, throws } from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { authorizeRoute } from './route-authorization';

function signTestToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.CAMPUS_ONE_AUTH_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function run() {
  process.env.CAMPUS_ONE_AUTH_SECRET = 'test-secret-with-enough-length';

  const user = authorizeRoute({
    authorization: `Bearer ${signTestToken({ sub: 'admin-1', role: 'alumni_admin', activeInstitutionId: 'school-a' })}`,
    role: 'alumni_admin',
    userId: 'admin-1',
    institutionId: 'school-a',
    schoolSlug: 'school-a',
    allowedRoles: ['alumni_admin'],
  });

  equal(user.id, 'admin-1');
  equal(user.role, 'alumni_admin');
  equal(user.schoolSlug, 'school-a');
  equal(user.activeInstitutionId, 'school-a');

  throws(
    () => authorizeRoute({ authorization: undefined, role: 'alumni_admin', userId: 'admin-1', allowedRoles: ['alumni_admin'] }),
    UnauthorizedException,
  );
  throws(
    () => authorizeRoute({ authorization: `Bearer ${signTestToken({ sub: 'admin-1', role: 'alumni_admin' })}`, role: undefined, userId: 'admin-1', allowedRoles: ['alumni_admin'] }),
    UnauthorizedException,
  );
  throws(
    () => authorizeRoute({ authorization: `Bearer ${signTestToken({ sub: 'student-1', role: 'student' })}`, role: 'student', userId: 'student-1', allowedRoles: ['alumni_admin'] }),
    ForbiddenException,
  );
  throws(
    () => authorizeRoute({ authorization: 'Bearer invalid.token.signature', role: 'alumni_admin', userId: 'admin-1', allowedRoles: ['alumni_admin'] }),
    UnauthorizedException,
  );
  throws(
    () => authorizeRoute({
      authorization: `Bearer ${signTestToken({ sub: 'admin-1', role: 'alumni_admin' })}`,
      role: 'alumni_admin',
      userId: 'spoofed-user',
      allowedRoles: ['alumni_admin'],
    }),
    UnauthorizedException,
  );
  throws(
    () => authorizeRoute({
      authorization: `Bearer ${signTestToken({ sub: 'admin-1', role: 'alumni_admin', activeInstitutionId: 'school-a' })}`,
      role: 'alumni_admin',
      userId: 'admin-1',
      institutionId: 'school-b',
      allowedRoles: ['alumni_admin'],
    }),
    ForbiddenException,
  );
}

run();
