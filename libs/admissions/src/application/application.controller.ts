import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../../auth/src/platform-auth/permissions.decorator';
import { Public } from '../../../auth/src/platform-auth/public.decorator';
import { ApplicationService } from './application.service';

@Controller('application')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Get('health')
  @Public()
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'application' };
  }

  @Get()
  @RequirePermissions('admissions.read')
  getHello(): string {
    return this.applicationService.getHello();
  }

  @Post('log-event')
  @RequirePermissions('admissions.write')
  logAdmissionEvent(@Body() dto: any) {
    return this.applicationService.logAdmissionEvent(dto);
  }

  @Post('create-profile')
  @Public()
  createApplicantProfile(@Body() dto: any) {
    return this.applicationService.createApplicantProfile(dto);
  }

  @Post('submit/:applicantId')
  @RequirePermissions('admissions.self.write')
  submitApplication(@Param('applicantId') applicantId: string) {
    return this.applicationService.submitApplication(applicantId);
  }

  @Post('track')
  @Public()
  trackApplication(@Body() dto: { email: string; referenceNumber: string }) {
    return this.applicationService.trackApplication(dto.email, dto.referenceNumber);
  }

  @Put('profile')
  @RequirePermissions('admissions.self.write')
  saveApplicantProfile(@Body() dto: any) {
    return this.applicationService.saveApplicantProfile(dto);
  }

  @Post('upload-document')
  @RequirePermissions('files.self.write')
  uploadApplicantDocument(@Body() dto: any) {
    return this.applicationService.uploadApplicantDocument(dto);
  }

  @Get('result/:applicantId')
  @RequirePermissions('admissions.self.write')
  getApplicantAdmissionResult(@Param('applicantId') applicantId: string) {
    return this.applicationService.getApplicantAdmissionResult(applicantId);
  }

  @Put('parent-information')
  @RequirePermissions('admissions.self.write')
  saveParentInformation(@Body() dto: any) {
    return this.applicationService.saveParentInformation(dto);
  }

  @Put('academic-background')
  @RequirePermissions('admissions.self.write')
  saveAcademicBackground(@Body() dto: any) {
    return this.applicationService.saveAcademicBackground(dto);
  }

  @Put('alumni-relatives')
  @RequirePermissions('admissions.self.write')
  saveAlumniRelatives(@Body() dto: any) {
    return this.applicationService.saveAlumniRelatives(dto);
  }

  @Put('program-selection')
  @RequirePermissions('admissions.self.write')
  saveProgramSelection(@Body() dto: any) {
    return this.applicationService.saveProgramSelection(dto);
  }

  @Get('status')
  @Public()
  fetchApplicationStatus(@Query('email') email: string, @Query('referenceNumber') referenceNumber: string) {
    return this.applicationService.fetchApplicationStatus(email, referenceNumber);
  }

  @Get('validate-access')
  @Public()
  validateApplicationAccess(@Query('email') email: string, @Query('referenceNumber') referenceNumber: string) {
    return this.applicationService.validateApplicationAccess(email, referenceNumber);
  }

  @Get('admin/applications')
  @RequirePermissions('admissions.read')
  fetchAdminApplications() {
    return this.applicationService.fetchAdminApplications();
  }

  @Get('admin/applications/:applicationId')
  @RequirePermissions('admissions.read')
  fetchAdminApplicationDetail(@Param('applicationId') applicationId: string) {
    return this.applicationService.fetchAdminApplicationDetail(applicationId);
  }

  @Put('admin/applications/:applicationId/status')
  @RequirePermissions('admissions.write')
  updateAdminApplicationStatus(
    @Param('applicationId') applicationId: string,
    @Body() dto: { status: 'Under Review' | 'Passed' | 'Not Accepted'; rejectionReason?: string },
  ) {
    return this.applicationService.updateAdminApplicationStatus(applicationId, dto.status, dto.rejectionReason);
  }

  @Get('admin/stats')
  @RequirePermissions('admissions.read')
  fetchAdminDashboardStats() {
    return this.applicationService.fetchAdminDashboardStats();
  }

  @Put('admin/applications/:applicationId/program-selection')
  @RequirePermissions('admissions.write')
  updateAdminProgramSelection(
    @Param('applicationId') applicationId: string,
    @Body() dto: { department: string; program: string },
  ) {
    return this.applicationService.updateAdminProgramSelection(applicationId, dto.department, dto.program);
  }
}
