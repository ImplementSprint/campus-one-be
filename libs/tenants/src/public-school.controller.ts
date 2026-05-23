import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../auth/src/platform-auth/public.decorator';
import { PublicSchoolService } from './public-school.service';

@Controller('schools')
@Public()
export class PublicSchoolController {
  constructor(private readonly publicSchoolService: PublicSchoolService) {}

  @Get()
  searchSchools(@Query('search') search?: string) {
    return this.publicSchoolService.searchSchools(search);
  }

  @Get(':slug')
  getSchoolBySlug(@Param('slug') slug: string) {
    return this.publicSchoolService.getSchoolBySlug(slug);
  }
}
