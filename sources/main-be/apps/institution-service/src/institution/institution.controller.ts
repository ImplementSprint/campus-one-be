import { Controller, Get, Post, Patch, Body, Headers, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { InitProfileDto } from './dto/init-profile.dto';

@Controller('institution')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get('profile')
  getProfile(@Headers('x-user-id') userId: string) {
    if (!userId) throw new UnauthorizedException();
    return this.institutionService.getProfile(userId);
  }

  @Patch('profile')
  updateProfile(@Headers('x-user-id') userId: string, @Body() dto: UpdateInstitutionDto) {
    if (!userId) throw new UnauthorizedException();
    return this.institutionService.updateProfile(userId, dto);
  }

  // Internal endpoint — called only by auth-service, not the frontend
  @Post('profile/init')
  @HttpCode(HttpStatus.OK)
  initProfile(@Body() dto: InitProfileDto) {
    return this.institutionService.initProfile(dto.userId, dto.email);
  }
}
