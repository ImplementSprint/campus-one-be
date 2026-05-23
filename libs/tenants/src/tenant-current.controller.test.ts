import { deepEqual, rejects } from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { TenantCurrentController } from './tenant-current.controller';

async function main() {
  const controller = new TenantCurrentController();

  const current = controller.getCurrentTenant({
    tenantContext: {
      institutionId: 'institution-123',
      schoolSlug: 'demo',
      source: 'mobile-header',
    },
  } as any);

  deepEqual(current, {
    institutionId: 'institution-123',
    schoolSlug: 'demo',
    source: 'mobile-header',
  });

  await rejects(
    async () => controller.getCurrentTenant({} as any),
    UnauthorizedException,
  );
  await rejects(
    async () => controller.getCurrentTenant({
      tenantContext: {
        source: 'unknown',
      },
    } as any),
    UnauthorizedException,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
