import 'reflect-metadata';
import 'dotenv/config';
import { createHmac } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/gateway/src/app.module';

type SmokeCase = {
  name: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  expectedStatus: number;
};

process.env.JWT_ACCESS_TOKEN_SECRET ||= 'core-smoke-secret-local';

function signSmokeToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_ACCESS_TOKEN_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const alumniAdminHeaders = {
  Authorization: `Bearer ${signSmokeToken({ sub: 'smoke-admin', role: 'alumni_admin' })}`,
  'X-User-Id': 'smoke-admin',
  'X-User-Role': 'alumni_admin',
};

function buildProfessorHeaders(professorId: string) {
  return {
    Authorization: `Bearer ${signSmokeToken({ sub: professorId, role: 'professor' })}`,
    'X-User-Id': professorId,
    'X-User-Role': 'professor',
  };
}

const professorHeaders = buildProfessorHeaders('professor-123');

type CoreSmokeSeeds = {
  professorId?: string;
  classId?: string;
  alumniActorUuid?: string;
  notificationProfileId?: string;
};

async function discoverCoreSmokeSeeds(): Promise<CoreSmokeSeeds> {
  if (!process.env.DATABASE_URL) return {};

  let pool: any;
  try {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const [professor, alumni, notification] = await Promise.all([
      pool.query(`
        select professor_id, id
        from public.class_assignments
        where professor_id is not null
          and coalesce(is_active, true) = true
        limit 1
      `).catch(() => ({ rows: [] })),
      pool.query(`
        select actor_uuid
        from alumni.alumni_record_requests
        where actor_uuid is not null
        limit 1
      `).catch(() => ({ rows: [] })),
      pool.query(`
        select profile_id
        from public.notifications
        where profile_id is not null
        limit 1
      `).catch(() => ({ rows: [] })),
    ]);

    return {
      professorId: professor.rows[0]?.professor_id,
      classId: professor.rows[0]?.id,
      alumniActorUuid: alumni.rows[0]?.actor_uuid,
      notificationProfileId: notification.rows[0]?.profile_id,
    };
  } catch (error: any) {
    console.log(`skip - live smoke seed discovery (${error?.message ?? error})`);
    return {};
  } finally {
    await pool?.end?.().catch(() => undefined);
  }
}

function getSeedValue(explicitValue: string | undefined, discoveredValue: string | undefined): string | undefined {
  return explicitValue?.trim() || discoveredValue?.trim() || undefined;
}

const smokeCases: SmokeCase[] = [
  {
    name: 'health endpoint',
    path: '/api/health',
    expectedStatus: 200,
  },
  {
    name: 'professor schedule rejects blank professor id',
    path: '/api/professor/%20/schedule',
    headers: professorHeaders,
    expectedStatus: 400,
  },
  {
    name: 'professor announcement create validates title',
    path: '/api/professor/professor-123/classes/class-123/announcements',
    method: 'POST',
    headers: professorHeaders,
    body: { title: '', content: 'Body' },
    expectedStatus: 400,
  },
  {
    name: 'grade submit validates required payload',
    path: '/api/grades/professor/submit',
    method: 'POST',
    headers: professorHeaders,
    body: { professorId: 'professor-123' },
    expectedStatus: 400,
  },
  {
    name: 'alumni record request validates document type',
    path: '/api/alumni/records/request',
    method: 'POST',
    body: {
      actor_uuid: 'actor-123',
      tenant_id: 'school-a',
      document_type: 'TRANSCRIPT',
    },
    expectedStatus: 400,
  },
  {
    name: 'alumni fulfillment validates payment status',
    path: '/api/alumni/admin/requests/request-123',
    method: 'PATCH',
    headers: alumniAdminHeaders,
    body: { status_code: 200, payment_status: 'settled' },
    expectedStatus: 400,
  },
  {
    name: 'notifications list rejects blank profile id',
    path: '/api/notifications/%20',
    expectedStatus: 400,
  },
  {
    name: 'notification create validates title',
    path: '/api/notifications/profile-123',
    method: 'POST',
    body: { title: '' },
    expectedStatus: 400,
  },
];

async function buildLiveDbSmokeCases(): Promise<SmokeCase[]> {
  const liveCases: SmokeCase[] = [];
  const discovered = await discoverCoreSmokeSeeds();
  const professorId = getSeedValue(process.env.CORE_SMOKE_PROFESSOR_ID, discovered.professorId);
  const classId = getSeedValue(process.env.CORE_SMOKE_CLASS_ID, discovered.classId);
  const alumniActorUuid = getSeedValue(process.env.CORE_SMOKE_ALUMNI_ACTOR_UUID, discovered.alumniActorUuid);
  const notificationProfileId = getSeedValue(process.env.CORE_SMOKE_NOTIFICATION_PROFILE_ID, discovered.notificationProfileId);

  if (professorId && classId) {
    liveCases.push({
      name: 'live professor announcements load',
      path: `/api/professor/${encodeURIComponent(professorId)}/classes/${encodeURIComponent(classId)}/announcements`,
      headers: buildProfessorHeaders(professorId),
      expectedStatus: 200,
    });
  } else {
    console.log('skip - live professor announcements load (CORE_SMOKE_PROFESSOR_ID and CORE_SMOKE_CLASS_ID not set)');
  }

  if (alumniActorUuid) {
    liveCases.push({
      name: 'live alumni records load',
      path: `/api/alumni/records/${encodeURIComponent(alumniActorUuid)}`,
      expectedStatus: 200,
    });
  } else {
    console.log('skip - live alumni records load (CORE_SMOKE_ALUMNI_ACTOR_UUID not set)');
  }

  if (notificationProfileId) {
    liveCases.push({
      name: 'live notifications load',
      path: `/api/notifications/${encodeURIComponent(notificationProfileId)}`,
      expectedStatus: 200,
    });
  } else {
    console.log('skip - live notifications load (CORE_SMOKE_NOTIFICATION_PROFILE_ID not set)');
  }

  return liveCases;
}

async function runSmoke() {
  console.log('Starting core flow smoke matrix...');
  const app = await NestFactory.create(AppModule, { abortOnError: false, logger: false });
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(0, '127.0.0.1');

  try {
    const url = await app.getUrl();
    for (const smokeCase of [...smokeCases, ...await buildLiveDbSmokeCases()]) {
      const response = await fetch(`${url}${smokeCase.path}`, {
        method: smokeCase.method ?? 'GET',
        headers: {
          ...(smokeCase.body ? { 'Content-Type': 'application/json' } : {}),
          ...(smokeCase.headers ?? {}),
        },
        body: smokeCase.body ? JSON.stringify(smokeCase.body) : undefined,
      });

      if (response.status !== smokeCase.expectedStatus) {
        const body = await response.text().catch(() => '');
        throw new Error(`${smokeCase.name}: expected ${smokeCase.expectedStatus}, received ${response.status}. ${body}`);
      }

      console.log(`ok - ${smokeCase.name}`);
    }
  } finally {
    await app.close();
  }
}

runSmoke().catch((error) => {
  console.error(error);
  process.exit(1);
});
