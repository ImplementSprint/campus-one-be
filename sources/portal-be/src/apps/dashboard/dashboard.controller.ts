import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':userId')
  async getDashboard(@Param('userId') userId: string) {
    try { return await this.dashboardService.getDashboard(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
