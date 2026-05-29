import { BadRequestException, Controller, Get, Headers, Query } from '@nestjs/common';
import { PostgresAcademicsRepository } from '../../academics/src/academics-postgres.repository';
import { authorizeRoute } from '../../auth/src/platform-auth/route-authorization';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  private readonly academicsRepository = new PostgresAcademicsRepository();

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

  @Get('academic-events')
  async listAcademicEvents(
    @Query('studentId') studentId?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['super_admin'] });
    if (!institutionId?.trim()) throw new BadRequestException('Institution id is required');

    return {
      events: await this.academicsRepository.listAuditEvents({
        institutionId,
        studentId,
        action,
        limit: Number(limit) || 100,
      }),
    };
  }
}
