import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { SubjectsService } from './subjects.service';

@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  async getSubjects() {
    try { return await this.subjectsService.getSubjects(); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get('user/:userId')
  async getUserInfo(@Param('userId') userId: string) {
    try { return await this.subjectsService.getUserInfo(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
