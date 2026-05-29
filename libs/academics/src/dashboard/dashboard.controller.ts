import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service';
import type { TenantContext } from '../../../tenants/src/tenant-context';

type TenantRequest = Request & { tenantContext?: TenantContext };

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('me')
  async getCurrentDashboard(
    @Headers('x-user-id') actorUserId: string,
    @Headers('x-institution-id') institutionId?: string,
    @Req() req?: TenantRequest,
  ) {
    if (!actorUserId?.trim()) throw new UnauthorizedException();
    try { return await this.dashboardService.getDashboard(actorUserId, resolveInstitutionId(institutionId, req)); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get(':userId')
  async getDashboard(
    @Param('userId') userId: string,
    @Headers('x-institution-id') institutionId?: string,
    @Req() req?: TenantRequest,
  ) {
    try { return await this.dashboardService.getDashboard(userId, resolveInstitutionId(institutionId, req)); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}

function resolveInstitutionId(institutionId?: string, req?: TenantRequest) {
  return institutionId?.trim()
    || req?.tenantContext?.institutionId
    || req?.tenantContext?.resolvedInstitution?.id;
}
