import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { RequirePermissions } from '../../../auth/src/platform-auth/permissions.decorator';
import { GradesService } from './grades.service';

@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get(':userId')
  @RequirePermissions('grades.self.read')
  async getGrades(@Param('userId') userId: string) {
    try { return await this.gradesService.getGrades(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get(':userId/deficiencies')
  @RequirePermissions('grades.self.read')
  async getDeficiencies(@Param('userId') userId: string) {
    try { return await this.gradesService.getDeficiencies(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get(':userId/graduation')
  @RequirePermissions('grades.self.read')
  async getGraduation(@Param('userId') userId: string) {
    try { return await this.gradesService.getGraduation(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
