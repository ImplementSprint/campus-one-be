import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from './tenant-context';

type TenantRequest = Request & { tenantContext?: TenantContext };

@Controller('tenant')
export class TenantCurrentController {
  @Get('current')
  getCurrentTenant(@Req() req: TenantRequest): TenantContext {
    if (!req.tenantContext || req.tenantContext.source === 'unknown') {
      throw new UnauthorizedException('Tenant context is required.');
    }
    return req.tenantContext;
  }
}
