import { Controller, Get, Patch, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { RequirePermissions } from '../../../auth/src/platform-auth/permissions.decorator';
import { InstitutionService } from './institution.service';
import { UpdateInstitutionDto } from './dto/update-institution.dto';

@Controller('institution')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get('profile')
  @RequirePermissions('tenant.settings.read')
  getProfile(@Headers('x-user-id') userId: string) {
    if (!userId) throw new UnauthorizedException();
    return this.institutionService.getProfile(userId);
  }

  @Patch('profile')
  @RequirePermissions('tenant.settings.write')
  updateProfile(@Headers('x-user-id') userId: string, @Body() dto: UpdateInstitutionDto) {
    if (!userId) throw new UnauthorizedException();
    return this.institutionService.updateProfile(userId, dto);
  }
}
