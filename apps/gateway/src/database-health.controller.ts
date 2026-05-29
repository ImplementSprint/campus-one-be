import { Controller, Get, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { authorizeRoute } from '../../../libs/auth/src/platform-auth/route-authorization';
import { DatabaseHealthService } from './database-health.service';

@Controller('health/db')
export class DatabaseHealthController {
  constructor(private readonly databaseHealthService: DatabaseHealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async checkDatabases(
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    authorizeRoute({
      authorization,
      role,
      userId,
      institutionId,
      schoolSlug,
      allowedRoles: ['super_admin'],
    });

    return this.databaseHealthService.checkDatabases();
  }
}
