import { Controller, Get, Headers, Query } from '@nestjs/common';
import { authorizeRoute } from '../../auth/src/platform-auth/route-authorization';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  async listEvents(
    @Query('limit') limit?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['super_admin'] });
    return { events: await this.auditService.list(Number(limit) || 100) };
  }
}
