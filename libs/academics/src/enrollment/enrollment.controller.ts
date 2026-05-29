import { BadRequestException, Controller, Get, Post, Param, Body, Query, HttpException, HttpStatus, Headers } from '@nestjs/common';
import { authorizeRoute } from '../../../auth/src/platform-auth/route-authorization';
import { EnrollmentService, findDuplicateClassAssignmentIds } from './enrollment.service';

@Controller('enrollment')
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Get('history/:studentId')
  async getHistory(
    @Param('studentId') studentId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, userId, institutionId, schoolSlug);
    try { return await this.enrollmentService.getHistory(studentId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get('offerings')
  async getOfferings(
    @Query('studentId') studentId?: string,
    @Query('program') program?: string,
    @Query('yearLevel') yearLevel?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, userId, institutionId, schoolSlug);
    try { return await this.enrollmentService.getOfferings(studentId, program, yearLevel, institutionId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Post('submit')
  async submit(
    @Body() body: { studentId: string; classAssignmentIds: string[] },
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, userId, institutionId, schoolSlug);
    if (!body?.studentId || !Array.isArray(body.classAssignmentIds) || !body.classAssignmentIds.length) {
      throw new BadRequestException('Missing required fields: studentId and classAssignmentIds');
    }
    if (findDuplicateClassAssignmentIds(body.classAssignmentIds).length) {
      throw new BadRequestException('Duplicate class selections are not allowed');
    }

    try { return await this.enrollmentService.submit(body.studentId, body.classAssignmentIds, institutionId); }
    catch (e: any) { throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Post('add-drop')
  async addDrop(
    @Body() body: { studentId: string; addClassAssignmentIds?: string[]; dropEnrollmentIds?: string[]; reason?: string },
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, userId, institutionId, schoolSlug);
    if (!body?.studentId || (!body.addClassAssignmentIds?.length && !body.dropEnrollmentIds?.length)) {
      throw new BadRequestException('Add/drop requires at least one class to add or enrollment to drop');
    }

    try { return await this.enrollmentService.addDrop(body); }
    catch (e: any) { throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Post('irregular-approval')
  async requestIrregularApproval(
    @Body() body: { studentId: string; classAssignmentIds: string[]; reason: string },
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, userId, institutionId, schoolSlug);
    if (!body?.studentId || !body.classAssignmentIds?.length || !body.reason?.trim()) {
      throw new BadRequestException('Irregular approval requires studentId, classAssignmentIds, and reason');
    }

    try { return await this.enrollmentService.requestIrregularApproval(body); }
    catch (e: any) { throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Post('registrar-approval')
  async approveByRegistrar(
    @Body() body: { requestId: string; registrarId: string; notes?: string },
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, userId, institutionId, schoolSlug);
    if (!body?.requestId?.trim() || !body.registrarId?.trim()) {
      throw new BadRequestException('Registrar approval requires requestId and registrarId');
    }

    try { return await this.enrollmentService.approveByRegistrar(body); }
    catch (e: any) { throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Post('confirm')
  async confirm(
    @Body() body: { studentId: string; enrollmentIds: string[] },
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, userId, institutionId, schoolSlug);
    if (!body?.studentId || !body.enrollmentIds?.length) {
      throw new BadRequestException('Enrollment confirmation requires studentId and enrollmentIds');
    }

    try { return await this.enrollmentService.confirm(body); }
    catch (e: any) { throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get('status/:studentId')
  async getStatus(
    @Param('studentId') studentId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, userId, institutionId, schoolSlug);
    try { return await this.enrollmentService.getStatus(studentId, institutionId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  private authorizeStudent(authorization?: string, role?: string, userId?: string, institutionId?: string, schoolSlug?: string) {
    return authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['student', 'super_admin'] });
  }
}
