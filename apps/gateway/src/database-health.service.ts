import { Injectable } from '@nestjs/common';
import { Client } from 'pg';

type DatabaseHealthStatus = 'ok' | 'missing_env' | 'unhealthy';

export type DatabaseHealthCheck = {
  name: string;
  envKey: string;
  status: DatabaseHealthStatus;
  latencyMs?: number;
  error?: string;
};

export type DatabaseHealthReport = {
  status: 'ok' | 'degraded';
  service: 'campus-one-backend';
  check: 'database';
  databases: DatabaseHealthCheck[];
};

const SERVICE_DATABASES = [
  { name: 'tenant_registry', envKey: 'TENANT_REGISTRY_DATABASE_URL' },
  { name: 'identity_access', envKey: 'IDENTITY_ACCESS_DATABASE_URL' },
  { name: 'academics', envKey: 'ACADEMICS_DATABASE_URL' },
  { name: 'admissions', envKey: 'ADMISSIONS_DATABASE_URL' },
  { name: 'registrar', envKey: 'REGISTRAR_DATABASE_URL' },
  { name: 'alumni', envKey: 'ALUMNI_DATABASE_URL' },
  { name: 'billing', envKey: 'BILLING_DATABASE_URL' },
  { name: 'notifications_audit', envKey: 'NOTIFICATIONS_AUDIT_DATABASE_URL' },
] as const;

function isPlaceholder(value: string): boolean {
  return value.includes('placeholder') || value.startsWith('replace-with-');
}

@Injectable()
export class DatabaseHealthService {
  async checkDatabases(env: NodeJS.ProcessEnv = process.env): Promise<DatabaseHealthReport> {
    const databases = await Promise.all(
      SERVICE_DATABASES.map(async ({ name, envKey }) => this.checkDatabase(name, envKey, env[envKey])),
    );

    return {
      status: databases.every((database) => database.status === 'ok') ? 'ok' : 'degraded',
      service: 'campus-one-backend',
      check: 'database',
      databases,
    };
  }

  private async checkDatabase(
    name: string,
    envKey: string,
    rawConnectionString: string | undefined,
  ): Promise<DatabaseHealthCheck> {
    const connectionString = rawConnectionString?.trim();

    if (!connectionString || isPlaceholder(connectionString)) {
      return { name, envKey, status: 'missing_env' };
    }

    const startedAt = Date.now();
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 2_000,
      query_timeout: 2_000,
    });

    try {
      await client.connect();
      await client.query('SELECT 1');

      return {
        name,
        envKey,
        status: 'ok',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        name,
        envKey,
        status: 'unhealthy',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Unknown database health error.',
      };
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
