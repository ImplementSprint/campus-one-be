import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { RequirePermissions } from '../../../auth/src/platform-auth/permissions.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':userId')
  @RequirePermissions('tenant.bootstrap.read')
  async getDashboard(@Param('userId') userId: string) {
    try { return await this.dashboardService.getDashboard(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
