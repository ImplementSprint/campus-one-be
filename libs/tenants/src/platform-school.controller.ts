import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../auth/src/platform-auth/public.decorator';
import { RequirePermissions } from '../../auth/src/platform-auth/permissions.decorator';
import { RegisterSchoolDto } from './school-onboarding.dto';
import { SchoolOnboardingService } from './school-onboarding.service';
import { RejectSchoolDto, SchoolReviewNoteDto } from './platform-school-review.dto';
import { PlatformSchoolReviewService } from './platform-school-review.service';

type PlatformRequest = Request & {
  currentUser?: {
    id?: string;
  };
};

@Controller('platform/schools')
export class PlatformSchoolController {
  constructor(
    private readonly schoolOnboardingService: SchoolOnboardingService,
    private readonly platformSchoolReviewService: PlatformSchoolReviewService,
  ) {}

  @Post('register')
  @Public()
  registerSchool(@Body() dto: RegisterSchoolDto) {
    return this.schoolOnboardingService.registerSchool(dto);
  }

  @Get()
  @RequirePermissions('platform.schools.read')
  listSchools(@Query('status') status?: string) {
    return this.platformSchoolReviewService.listSchools(status);
  }

  @Get(':id')
  @RequirePermissions('platform.schools.read')
  getSchool(@Param('id') id: string) {
    return this.platformSchoolReviewService.getSchool(id);
  }

  @Post(':id/approve')
  @RequirePermissions('platform.schools.write')
  approveSchool(@Param('id') id: string, @Req() request: PlatformRequest) {
    return this.platformSchoolReviewService.approveSchool(id, getActorUserId(request));
  }

  @Post(':id/reject')
  @RequirePermissions('platform.schools.write')
  rejectSchool(@Param('id') id: string, @Body() dto: RejectSchoolDto, @Req() request: PlatformRequest) {
    return this.platformSchoolReviewService.rejectSchool(id, getActorUserId(request), dto.reason);
  }

  @Post(':id/suspend')
  @RequirePermissions('platform.schools.write')
  suspendSchool(@Param('id') id: string, @Body() dto: SchoolReviewNoteDto, @Req() request: PlatformRequest) {
    return this.platformSchoolReviewService.suspendSchool(id, getActorUserId(request), dto.reason);
  }

  @Post(':id/reactivate')
  @RequirePermissions('platform.schools.write')
  reactivateSchool(@Param('id') id: string, @Body() dto: SchoolReviewNoteDto, @Req() request: PlatformRequest) {
    return this.platformSchoolReviewService.reactivateSchool(id, getActorUserId(request), dto.reason);
  }
}

function getActorUserId(request: PlatformRequest): string {
  const actorUserId = request.currentUser?.id;
  if (!actorUserId) throw new UnauthorizedException('Missing current user.');
  return actorUserId;
}
