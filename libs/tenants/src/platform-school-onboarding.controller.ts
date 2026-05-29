import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import type {
  SchoolApproveRequest,
  SchoolOwnerActivationRequest,
  SchoolRegistrationRequest,
  SchoolReviewActionRequest,
} from '@campus-one/contracts';
import { authorizeRoute } from '../../auth/src/platform-auth/route-authorization';
import { PlatformSchoolOnboardingService } from './platform-school-onboarding.service';

const PLATFORM_REVIEW_ROLES = ['super_admin'];

@Controller('platform/schools')
export class PlatformSchoolOnboardingController {
  constructor(private readonly onboardingService: PlatformSchoolOnboardingService) {}

  @Get()
  listSchools(
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    this.authorizePlatformReview(authorization, role, userId);
    return this.onboardingService.listSchools();
  }

  @Get('slug-availability')
  checkSlugAvailability(@Query('slug') slug = '') {
    return this.onboardingService.checkSlugAvailability(slug);
  }

  @Get(':id')
  getSchool(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    this.authorizePlatformReview(authorization, role, userId);
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
  approveSchool(
    @Param('id') id: string,
    @Body() body: SchoolApproveRequest,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    const user = this.authorizePlatformReview(authorization, role, userId);
    return this.onboardingService.approveSchool(id, {
      ...body,
      approverId: user.id,
      approverEmail: user.email ?? body.approverEmail,
    });
  }

  @Patch(':id/reject')
  rejectSchool(
    @Param('id') id: string,
    @Body() body: SchoolReviewActionRequest,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    const user = this.authorizePlatformReview(authorization, role, userId);
    return this.onboardingService.rejectSchool(id, { ...body, actorEmail: user.email ?? body.actorEmail });
  }

  @Patch(':id/suspend')
  suspendSchool(
    @Param('id') id: string,
    @Body() body: SchoolReviewActionRequest,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    const user = this.authorizePlatformReview(authorization, role, userId);
    return this.onboardingService.suspendSchool(id, { ...body, actorEmail: user.email ?? body.actorEmail });
  }

  @Patch(':id/reactivate')
  reactivateSchool(
    @Param('id') id: string,
    @Body() body: SchoolReviewActionRequest,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    const user = this.authorizePlatformReview(authorization, role, userId);
    return this.onboardingService.reactivateSchool(id, { ...body, actorEmail: user.email ?? body.actorEmail });
  }

  private authorizePlatformReview(authorization?: string, role?: string, userId?: string) {
    return authorizeRoute({
      authorization,
      role,
      userId,
      allowedRoles: PLATFORM_REVIEW_ROLES,
    });
  }
}
