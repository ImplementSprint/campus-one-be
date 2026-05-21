import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApplicationService } from './application.service';

@Controller('application')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Get('health')
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'application' };
  }

  @Get()
  getHello(): string {
    return this.applicationService.getHello();
  }

  @Post('log-event')
  logAdmissionEvent(@Body() dto: any) {
    return this.applicationService.logAdmissionEvent(dto);
  }

  @Post('create-profile')
  createApplicantProfile(@Body() dto: any) {
    return this.applicationService.createApplicantProfile(dto);
  }

  @Post('submit/:applicantId')
  submitApplication(@Param('applicantId') applicantId: string) {
    return this.applicationService.submitApplication(applicantId);
  }

  @Post('track')
  trackApplication(@Body() dto: { email: string; referenceNumber: string }) {
    return this.applicationService.trackApplication(dto.email, dto.referenceNumber);
  }

  @Put('profile')
  saveApplicantProfile(@Body() dto: any) {
    return this.applicationService.saveApplicantProfile(dto);
  }

  @Post('upload-document')
  uploadApplicantDocument(@Body() dto: any) {
    return this.applicationService.uploadApplicantDocument(dto);
  }

  @Get('result/:applicantId')
  getApplicantAdmissionResult(@Param('applicantId') applicantId: string) {
    return this.applicationService.getApplicantAdmissionResult(applicantId);
  }

  @Put('parent-information')
  saveParentInformation(@Body() dto: any) {
    return this.applicationService.saveParentInformation(dto);
  }

  @Put('academic-background')
  saveAcademicBackground(@Body() dto: any) {
    return this.applicationService.saveAcademicBackground(dto);
  }

  @Put('alumni-relatives')
  saveAlumniRelatives(@Body() dto: any) {
    return this.applicationService.saveAlumniRelatives(dto);
  }

  @Put('program-selection')
  saveProgramSelection(@Body() dto: any) {
    return this.applicationService.saveProgramSelection(dto);
  }

  @Get('status')
  fetchApplicationStatus(@Query('email') email: string, @Query('referenceNumber') referenceNumber: string) {
    return this.applicationService.fetchApplicationStatus(email, referenceNumber);
  }

  @Get('validate-access')
  validateApplicationAccess(@Query('email') email: string, @Query('referenceNumber') referenceNumber: string) {
    return this.applicationService.validateApplicationAccess(email, referenceNumber);
  }

  @Get('admin/applications')
  fetchAdminApplications() {
    return this.applicationService.fetchAdminApplications();
  }

  @Get('admin/applications/:applicationId')
  fetchAdminApplicationDetail(@Param('applicationId') applicationId: string) {
    return this.applicationService.fetchAdminApplicationDetail(applicationId);
  }

  @Put('admin/applications/:applicationId/status')
  updateAdminApplicationStatus(
    @Param('applicationId') applicationId: string,
    @Body() dto: { status: 'Under Review' | 'Passed' | 'Not Accepted'; rejectionReason?: string },
  ) {
    return this.applicationService.updateAdminApplicationStatus(applicationId, dto.status, dto.rejectionReason);
  }

  @Get('admin/stats')
  fetchAdminDashboardStats() {
    return this.applicationService.fetchAdminDashboardStats();
  }

  @Put('admin/applications/:applicationId/program-selection')
  updateAdminProgramSelection(
    @Param('applicationId') applicationId: string,
    @Body() dto: { department: string; program: string },
  ) {
    return this.applicationService.updateAdminProgramSelection(applicationId, dto.department, dto.program);
  }
}
