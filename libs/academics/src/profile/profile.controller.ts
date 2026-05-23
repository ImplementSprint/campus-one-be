import { Controller, Get, Put, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { RequirePermissions } from '../../../auth/src/platform-auth/permissions.decorator';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':userId')
  @RequirePermissions('tenant.bootstrap.read')
  async getProfile(@Param('userId') userId: string) {
    try { return await this.profileService.getProfile(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Put(':userId')
  @RequirePermissions('users.write')
  async updateProfile(@Param('userId') userId: string, @Body() body: any) {
    try { return await this.profileService.updateProfile(userId, body); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
