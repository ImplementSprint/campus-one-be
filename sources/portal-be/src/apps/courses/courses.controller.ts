import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get(':userId')
  async getCourses(@Param('userId') userId: string) {
    try { return await this.coursesService.getCourses(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
