import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../../src/generated/prisma/tenant-registry/client';

function requireTenantRegistryDatabaseUrl(): string {
  const value = process.env.TENANT_REGISTRY_DATABASE_URL?.trim();
  if (!value || value.includes('placeholder') || value.startsWith('replace-with-')) {
    throw new Error(
      '[runtime-config] Missing required environment variable: TENANT_REGISTRY_DATABASE_URL',
    );
  }
  return value;
}

@Injectable()
export class TenantRegistryPrismaClient
  extends PrismaClient
  implements OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: requireTenantRegistryDatabaseUrl(),
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
