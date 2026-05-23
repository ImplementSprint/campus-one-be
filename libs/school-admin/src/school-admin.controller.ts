import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { authorizeRoute } from '../../auth/src/platform-auth/route-authorization';
import { SchoolAdminService } from './school-admin.service';

const SCHOOL_ADMIN_ROLES = ['school_owner', 'school_admin', 'registrar', 'super_admin'];

@Controller('school-admin')
export class SchoolAdminController {
  constructor(private readonly service: SchoolAdminService) {}

  @Get('settings/profile')
  getProfile(
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.getProfile(user.activeInstitutionId ?? institutionId ?? '');
  }

  @Patch('settings/profile')
  updateProfile(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.updateProfile(user.activeInstitutionId ?? institutionId ?? '', user.id, body);
  }

  @Get('users')
  listUsers(
    @Query('role') filterRole?: string,
    @Query('status') status?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.listUsers(user.activeInstitutionId ?? institutionId ?? '', { role: filterRole, status });
  }

  @Post('users/invite')
  inviteUser(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.inviteUser(user.activeInstitutionId ?? institutionId ?? '', user.id, body);
  }

  @Post('users')
  createUser(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.createUser(user.activeInstitutionId ?? institutionId ?? '', user.id, body);
  }

  @Patch('users/:id/role')
  assignRole(
    @Param('id') id: string,
    @Body('role') nextRole: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.assignRole(user.activeInstitutionId ?? institutionId ?? '', user.id, id, nextRole);
  }

  @Patch('users/:id/status')
  setUserStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.setUserStatus(user.activeInstitutionId ?? institutionId ?? '', user.id, id, status);
  }

  @Post('users/:id/password-reset')
  queuePasswordReset(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.queuePasswordReset(user.activeInstitutionId ?? institutionId ?? '', user.id, id);
  }

  @Post('users/invitations/:id/resend')
  resendInvite(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.resendInvite(user.activeInstitutionId ?? institutionId ?? '', user.id, id);
  }

  @Post('users/:id/alumni-admin-assignment')
  assignAlumniAdmin(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.assignAlumniAdmin(user.activeInstitutionId ?? institutionId ?? '', user.id, id);
  }

  @Get('academic/:resource')
  listAcademicRecords(
    @Param('resource') resource: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.listAcademicRecords(user.activeInstitutionId ?? institutionId ?? '', resource);
  }

  @Post('academic/:resource')
  createAcademicRecord(
    @Param('resource') resource: string,
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.createAcademicRecord(user.activeInstitutionId ?? institutionId ?? '', user.id, resource, body);
  }

  @Patch('academic/:resource/:id')
  updateAcademicRecord(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.updateAcademicRecord(user.activeInstitutionId ?? institutionId ?? '', user.id, resource, id, body);
  }

  @Delete('academic/:resource/:id')
  deleteAcademicRecord(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.deleteAcademicRecord(user.activeInstitutionId ?? institutionId ?? '', user.id, resource, id);
  }

  @Post('imports/:resource')
  importAcademicRecords(
    @Param('resource') resource: string,
    @Body() rows: Array<Record<string, unknown>>,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.importAcademicRecords(user.activeInstitutionId ?? institutionId ?? '', user.id, resource, rows);
  }

  @Get('export/:resource')
  exportAcademicRecords(
    @Param('resource') resource: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    const user = this.authorize(authorization, role, userId, institutionId, schoolSlug);
    return this.service.exportAcademicRecords(user.activeInstitutionId ?? institutionId ?? '', resource);
  }

  private authorize(
    authorization?: string,
    role?: string,
    userId?: string,
    institutionId?: string,
    schoolSlug?: string,
  ) {
    if (role && !SCHOOL_ADMIN_ROLES.includes(role)) {
      throw new ForbiddenException('Insufficient role for school administration.');
    }
    return authorizeRoute({
      authorization,
      role,
      userId,
      institutionId,
      schoolSlug,
      allowedRoles: SCHOOL_ADMIN_ROLES,
    });
  }
}
