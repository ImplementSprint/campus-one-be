import { throws } from 'node:assert/strict';
import { TenantRegistryPrismaClient } from './tenant-registry-prisma.client';

const originalUrl = process.env.TENANT_REGISTRY_DATABASE_URL;

try {
  delete process.env.TENANT_REGISTRY_DATABASE_URL;

  throws(
    () => new TenantRegistryPrismaClient(),
    /TENANT_REGISTRY_DATABASE_URL/,
  );
} finally {
  if (originalUrl === undefined) {
    delete process.env.TENANT_REGISTRY_DATABASE_URL;
  } else {
    process.env.TENANT_REGISTRY_DATABASE_URL = originalUrl;
  }
}
