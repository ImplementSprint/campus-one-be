import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../../src/generated/prisma/identity-access/client';

function requireIdentityAccessDatabaseUrl(): string {
  const value = process.env.IDENTITY_ACCESS_DATABASE_URL?.trim();
  if (!value || value.includes('placeholder') || value.startsWith('replace-with-')) {
    throw new Error(
      '[runtime-config] Missing required environment variable: IDENTITY_ACCESS_DATABASE_URL',
    );
  }
  return value;
}

@Injectable()
export class IdentityAccessPrismaClient
  extends PrismaClient
  implements OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: requireIdentityAccessDatabaseUrl(),
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
