import * as assert from 'node:assert/strict';
import { DatabaseHealthService } from './database-health.service';

async function run() {
  const service = new DatabaseHealthService();

  const missingReport = await service.checkDatabases({});
  assert.equal(missingReport.status, 'degraded');
  assert.equal(missingReport.service, 'campus-one-backend');
  assert.equal(missingReport.check, 'database');
  assert.equal(missingReport.databases.length, 8);
  assert.ok(missingReport.databases.every((database) => database.status === 'missing_env'));

  const placeholderReport = await service.checkDatabases({
    TENANT_REGISTRY_DATABASE_URL: 'replace-with-tenant-registry-url',
    IDENTITY_ACCESS_DATABASE_URL: 'postgresql://placeholder',
  });
  assert.equal(placeholderReport.status, 'degraded');
  assert.equal(placeholderReport.databases[0].status, 'missing_env');
  assert.equal(placeholderReport.databases[1].status, 'missing_env');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
