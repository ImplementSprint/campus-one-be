import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../../libs/auth/src/platform-auth/public.decorator';
import { RequirePermissions } from '../../../libs/auth/src/platform-auth/permissions.decorator';
import { DatabaseHealthService } from './database-health.service';

@Controller('health')
export class AppController {
  constructor(private readonly databaseHealthService: DatabaseHealthService) {}

  @Get()
  @Public()
  health() {
    return { status: 'ok', service: 'campus-one-backend' };
  }

  @Get('live')
  @Public()
  live() {
    return { status: 'ok', service: 'campus-one-backend', check: 'live' };
  }

  @Get('db')
  @RequirePermissions('audit.read')
  async database() {
    const report = await this.databaseHealthService.checkDatabases();
    if (report.status !== 'ok') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
