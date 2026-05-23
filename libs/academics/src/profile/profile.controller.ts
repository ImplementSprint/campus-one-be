import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  async getCurrentProfile(@Headers('x-user-id') actorUserId: string) {
    if (!actorUserId?.trim()) throw new UnauthorizedException();
    try { return await this.profileService.getProfile(actorUserId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Put('me')
  async updateCurrentProfile(
    @Body() body: any,
    @Headers('x-user-id') actorUserId: string,
  ) {
    if (!actorUserId?.trim()) throw new UnauthorizedException();
    try { return await this.profileService.updateProfile(actorUserId, body); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get(':userId')
  async getProfile(
    @Param('userId') userId: string,
    @Headers('x-user-id') actorUserId: string,
  ) {
    if (!actorUserId?.trim()) throw new UnauthorizedException();
    try { return await this.profileService.getProfile(userId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Put(':userId')
  async updateProfile(
    @Param('userId') userId: string,
    @Body() body: any,
    @Headers('x-user-id') actorUserId: string,
  ) {
    if (!actorUserId?.trim()) throw new UnauthorizedException();
    try { return await this.profileService.updateProfile(userId, body); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
