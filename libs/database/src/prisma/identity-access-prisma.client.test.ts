import { throws } from 'node:assert/strict';
import { IdentityAccessPrismaClient } from './identity-access-prisma.client';

const originalUrl = process.env.IDENTITY_ACCESS_DATABASE_URL;

try {
  delete process.env.IDENTITY_ACCESS_DATABASE_URL;

  throws(
    () => new IdentityAccessPrismaClient(),
    /IDENTITY_ACCESS_DATABASE_URL/,
  );
} finally {
  if (originalUrl === undefined) {
    delete process.env.IDENTITY_ACCESS_DATABASE_URL;
  } else {
    process.env.IDENTITY_ACCESS_DATABASE_URL = originalUrl;
  }
}
