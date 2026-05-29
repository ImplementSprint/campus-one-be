import { BadRequestException, Body, Controller, Get, Param, Post, HttpException, HttpStatus, Headers } from '@nestjs/common';
import { authorizeRoute } from '../../../auth/src/platform-auth/route-authorization';
import { GradesService } from './grades.service';

@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get('professor/:professorId/class/:classAssignmentId')
  async getProfessorGradebook(
    @Param('professorId') professorId: string,
    @Param('classAssignmentId') classAssignmentId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeProfessor(authorization, role, userId, institutionId, schoolSlug);
    try { return await this.gradesService.getProfessorGradebook(professorId, classAssignmentId, institutionId); }
    catch (e: any) { throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Post('professor/save')
  async saveProfessorGrade(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeProfessor(authorization, role, userId, institutionId, schoolSlug);
    if (!body?.professorId || !body?.enrollmentId || !hasAnyGradeValue(body)) {
      throw new BadRequestException('Missing required fields: professorId, enrollmentId, and at least one grade value');
    }

    try { return await this.gradesService.saveProfessorGrade(body); }
    catch (e: any) { throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Post('professor/submit')
  async submitProfessorGrade(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeProfessor(authorization, role, userId, institutionId, schoolSlug);
    if (!body?.professorId || !body?.enrollmentId || body.finalGrade == null || !body.letterGrade || !body.remarks) {
      throw new BadRequestException('Missing required fields: professorId, enrollmentId, finalGrade, letterGrade, and remarks');
    }

    try { return await this.gradesService.submitProfessorGrade(body, institutionId); }
    catch (e: any) { throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get(':userId/summary')
  async getSummary(
    @Param('userId') userId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') routeUserId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, routeUserId, institutionId, schoolSlug);
    try { return await this.gradesService.getSummary(userId, institutionId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get(':userId/terms/:term/summary')
  async getTermSummary(
    @Param('userId') userId: string,
    @Param('term') term: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') routeUserId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, routeUserId, institutionId, schoolSlug);
    try { return await this.gradesService.getTermSummary(userId, term, institutionId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get(':userId')
  async getGrades(
    @Param('userId') userId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') routeUserId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, routeUserId, institutionId, schoolSlug);
    try { return await this.gradesService.getGrades(userId, institutionId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get(':userId/deficiencies')
  async getDeficiencies(
    @Param('userId') userId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') routeUserId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, routeUserId, institutionId, schoolSlug);
    try { return await this.gradesService.getDeficiencies(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get(':userId/graduation')
  async getGraduation(
    @Param('userId') userId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') routeUserId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeStudent(authorization, role, routeUserId, institutionId, schoolSlug);
    try { return await this.gradesService.getGraduation(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  private authorizeProfessor(authorization?: string, role?: string, userId?: string, institutionId?: string, schoolSlug?: string) {
    return authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['professor', 'super_admin'] });
  }

  private authorizeStudent(authorization?: string, role?: string, userId?: string, institutionId?: string, schoolSlug?: string) {
    return authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['student', 'super_admin'] });
  }
}

function hasAnyGradeValue(body: any) {
  return ['prelimGrade', 'midtermGrade', 'finalsGrade', 'finalGrade', 'letterGrade', 'remarks']
    .some((field) => body[field] != null && body[field] !== '');
}
