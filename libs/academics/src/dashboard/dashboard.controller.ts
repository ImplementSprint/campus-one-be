import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('me')
  async getCurrentDashboard(@Headers('x-user-id') actorUserId: string) {
    if (!actorUserId?.trim()) throw new UnauthorizedException();
    try { return await this.dashboardService.getDashboard(actorUserId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get(':userId')
  async getDashboard(@Param('userId') userId: string) {
    try { return await this.dashboardService.getDashboard(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
