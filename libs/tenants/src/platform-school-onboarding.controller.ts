import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import type {
  SchoolApproveRequest,
  SchoolOwnerActivationRequest,
  SchoolRegistrationRequest,
  SchoolReviewActionRequest,
} from '@campus-one/contracts';
import { PlatformSchoolOnboardingService } from './platform-school-onboarding.service';

@Controller('platform/schools')
export class PlatformSchoolOnboardingController {
  constructor(private readonly onboardingService: PlatformSchoolOnboardingService) {}

  @Get()
  listSchools() {
    return this.onboardingService.listSchools();
  }

  @Get('slug-availability')
  checkSlugAvailability(@Query('slug') slug = '') {
    return this.onboardingService.checkSlugAvailability(slug);
  }

  @Get(':id')
  getSchool(@Param('id') id: string) {
    return this.onboardingService.getSchool(id);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  registerSchool(@Body() body: SchoolRegistrationRequest) {
    return this.onboardingService.registerSchool(body);
  }

  @Post('owner-activation')
  @HttpCode(HttpStatus.OK)
  activateOwner(@Body() body: SchoolOwnerActivationRequest) {
    return this.onboardingService.activateOwner(body);
  }

  @Patch(':id/approve')
  approveSchool(@Param('id') id: string, @Body() body: SchoolApproveRequest) {
    return this.onboardingService.approveSchool(id, body);
  }

  @Patch(':id/reject')
  rejectSchool(@Param('id') id: string, @Body() body: SchoolReviewActionRequest) {
    return this.onboardingService.rejectSchool(id, body);
  }

  @Patch(':id/suspend')
  suspendSchool(@Param('id') id: string, @Body() body: SchoolReviewActionRequest) {
    return this.onboardingService.suspendSchool(id, body);
  }

  @Patch(':id/reactivate')
  reactivateSchool(@Param('id') id: string, @Body() body: SchoolReviewActionRequest) {
    return this.onboardingService.reactivateSchool(id, body);
  }
}
