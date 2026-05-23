import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { RequirePermissions } from '../../../auth/src/platform-auth/permissions.decorator';
import { SubjectsService } from './subjects.service';

@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @RequirePermissions('academics.read')
  async getSubjects() {
    try { return await this.subjectsService.getSubjects(); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get('user/:userId')
  @RequirePermissions('tenant.bootstrap.read')
  async getUserInfo(@Param('userId') userId: string) {
    try { return await this.subjectsService.getUserInfo(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
