import { Controller, Get, Post, Param, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';

@Controller('enrollment')
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Get('history/:studentId')
  async getHistory(@Param('studentId') studentId: string) {
    try { return await this.enrollmentService.getHistory(studentId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get('offerings')
  async getOfferings(
    @Query('studentId') studentId?: string,
    @Query('program') program?: string,
    @Query('yearLevel') yearLevel?: string,
  ) {
    try { return await this.enrollmentService.getOfferings(studentId, program, yearLevel); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Post('submit')
  async submit(@Body() body: { studentId: string; classAssignmentIds: string[] }) {
    try { return await this.enrollmentService.submit(body.studentId, body.classAssignmentIds); }
    catch (e: any) { throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get('status/:studentId')
  async getStatus(@Param('studentId') studentId: string) {
    try { return await this.enrollmentService.getStatus(studentId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
