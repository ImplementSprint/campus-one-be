import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ADMISSIONS_WORKFLOW_STATUSES,
  AdmissionsWorkflowStatus,
  ApplicationService,
} from './application.service';
import { Headers } from '@nestjs/common';

const VALID_DOCUMENT_STATUSES = ['approved', 'rejected', 'pending'] as const;
type DocumentReviewStatus = (typeof VALID_DOCUMENT_STATUSES)[number];

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
  createApplicantProfile(@Body() dto: any, @Headers('x-institution-id') institutionId?: string) {
    return this.applicationService.createApplicantProfile(dto, institutionId);
  }

  @Post('submit/:applicantId')
  submitApplication(@Param('applicantId') applicantId: string, @Headers('x-institution-id') institutionId?: string) {
    return this.applicationService.submitApplication(applicantId, institutionId);
  }

  @Post('track')
  trackApplication(@Body() dto: { email: string; referenceNumber: string }, @Headers('x-institution-id') institutionId?: string) {
    this.validateTrackingFields(dto?.email, dto?.referenceNumber);
    return this.applicationService.trackApplication(dto.email, dto.referenceNumber, institutionId);
  }

  @Put('profile')
  saveApplicantProfile(@Body() dto: any, @Headers('x-institution-id') institutionId?: string) {
    return this.applicationService.saveApplicantProfile(dto, institutionId);
  }

  @Post('upload-document')
  uploadApplicantDocument(@Body() dto: any, @Headers('x-institution-id') institutionId?: string) {
    return this.applicationService.uploadApplicantDocument(dto, institutionId);
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
  saveProgramSelection(@Body() dto: any, @Headers('x-institution-id') institutionId?: string) {
    return this.applicationService.saveProgramSelection(dto, institutionId);
  }

  @Get('status')
  fetchApplicationStatus(
    @Query('email') email: string,
    @Query('referenceNumber') referenceNumber: string,
    @Headers('x-institution-id') institutionId?: string,
  ) {
    this.validateTrackingFields(email, referenceNumber);
    return this.applicationService.fetchApplicationStatus(email, referenceNumber, institutionId);
  }

  @Get('validate-access')
  validateApplicationAccess(
    @Query('email') email: string,
    @Query('referenceNumber') referenceNumber: string,
    @Headers('x-institution-id') institutionId?: string,
  ) {
    this.validateTrackingFields(email, referenceNumber);
    return this.applicationService.validateApplicationAccess(email, referenceNumber, institutionId);
  }

  @Get('admin/applications')
  fetchAdminApplications(@Headers('x-institution-id') institutionId?: string) {
    return this.applicationService.fetchAdminApplications(institutionId);
  }

  @Get('admin/applications/:applicationId')
  fetchAdminApplicationDetail(
    @Param('applicationId') applicationId: string,
    @Headers('x-institution-id') institutionId?: string,
  ) {
    return this.applicationService.fetchAdminApplicationDetail(applicationId, institutionId);
  }

  @Put('admin/applications/:applicationId/status')
  updateAdminApplicationStatus(
    @Param('applicationId') applicationId: string,
    @Body() dto: {
      status: AdmissionsWorkflowStatus;
      rejectionReason?: string;
      remarks?: string;
      actorEmail?: string;
      acceptanceLetterUrl?: string;
    },
    @Headers('x-institution-id') institutionId?: string,
  ) {
    this.validateApplicationId(applicationId);
    this.validateAdminStatus(dto?.status);
    if ((dto.status === 'Not Accepted' || dto.status === 'Rejected') && !this.hasText(dto.rejectionReason)) {
      throw new BadRequestException('rejectionReason is required when status is rejected');
    }

    return this.applicationService.updateAdminApplicationStatus(
      applicationId,
      dto.status,
      {
        rejectionReason: dto.rejectionReason,
        remarks: dto.remarks,
        actorEmail: dto.actorEmail,
        acceptanceLetterUrl: dto.acceptanceLetterUrl,
      },
      institutionId,
    );
  }

  @Get('admin/stats')
  fetchAdminDashboardStats() {
    return this.applicationService.fetchAdminDashboardStats();
  }

  @Put('admin/applications/:applicationId/program-selection')
  updateAdminProgramSelection(
    @Param('applicationId') applicationId: string,
    @Body() dto: { department: string; program: string },
    @Headers('x-institution-id') institutionId?: string,
  ) {
    if (!this.hasText(applicationId) || !this.hasText(dto?.department) || !this.hasText(dto?.program)) {
      throw new BadRequestException('applicationId, department, and program are required');
    }

    return this.applicationService.updateAdminProgramSelection(applicationId, dto.department, dto.program, institutionId);
  }

  @Put('admin/applications/:applicationId/documents/:documentId/verification')
  verifyApplicantDocument(
    @Param('applicationId') applicationId: string,
    @Param('documentId') documentId: string,
    @Body() dto: { status: DocumentReviewStatus; rejectionReason?: string; remarks?: string; actorEmail?: string },
  ) {
    this.validateApplicationId(applicationId);
    if (!this.hasText(documentId)) {
      throw new BadRequestException('documentId is required');
    }
    if (!VALID_DOCUMENT_STATUSES.includes(dto?.status as DocumentReviewStatus)) {
      throw new BadRequestException('Invalid document status');
    }
    if (dto.status === 'rejected' && !this.hasText(dto.rejectionReason) && !this.hasText(dto.remarks)) {
      throw new BadRequestException('rejectionReason or remarks is required when rejecting a document');
    }
    return this.applicationService.verifyApplicantDocument(applicationId, documentId, dto.status, {
      rejectionReason: dto.rejectionReason,
      remarks: dto.remarks,
      actorEmail: dto.actorEmail,
    });
  }

  @Put('admin/applications/:applicationId/missing-requirements')
  recordMissingRequirements(
    @Param('applicationId') applicationId: string,
    @Body() dto: { requirements: string[]; remarks?: string; actorEmail?: string },
  ) {
    this.validateApplicationId(applicationId);
    if (!Array.isArray(dto?.requirements) || dto.requirements.every((requirement) => !this.hasText(requirement))) {
      throw new BadRequestException('At least one missing requirement is required');
    }
    return this.applicationService.recordMissingRequirements(
      applicationId,
      dto.requirements.filter((requirement) => this.hasText(requirement)),
      { remarks: dto.remarks, actorEmail: dto.actorEmail },
    );
  }

  @Put('admin/applications/:applicationId/entrance-exam')
  scheduleEntranceExam(
    @Param('applicationId') applicationId: string,
    @Body() dto: { examDate: string; examTime: string; examVenue: string; permitNumber?: string; actorEmail?: string },
  ) {
    this.validateApplicationId(applicationId);
    if (!this.hasText(dto?.examDate) || !this.hasText(dto?.examTime) || !this.hasText(dto?.examVenue)) {
      throw new BadRequestException('examDate, examTime, and examVenue are required');
    }
    return this.applicationService.scheduleEntranceExam(applicationId, dto);
  }

  @Put('admin/applications/:applicationId/interview')
  scheduleInterview(
    @Param('applicationId') applicationId: string,
    @Body() dto: { interviewDate: string; interviewTime: string; interviewVenue: string; actorEmail?: string },
  ) {
    this.validateApplicationId(applicationId);
    if (!this.hasText(dto?.interviewDate) || !this.hasText(dto?.interviewTime) || !this.hasText(dto?.interviewVenue)) {
      throw new BadRequestException('interviewDate, interviewTime, and interviewVenue are required');
    }
    return this.applicationService.scheduleInterview(applicationId, dto);
  }

  @Post('admin/applications/:applicationId/convert-to-student')
  convertAcceptedApplicantToStudent(
    @Param('applicationId') applicationId: string,
    @Body() dto: { actorEmail?: string; remarks?: string } = {},
    @Headers('x-institution-id') institutionId?: string,
  ) {
    this.validateApplicationId(applicationId);
    return this.applicationService.convertAcceptedApplicantToStudent(applicationId, dto, institutionId);
  }

  private validateTrackingFields(email?: string, referenceNumber?: string) {
    if (!this.hasText(email) || !this.hasText(referenceNumber)) {
      throw new BadRequestException('Email and referenceNumber are required');
    }
  }

  private validateApplicationId(applicationId?: string) {
    if (!this.hasText(applicationId)) {
      throw new BadRequestException('applicationId is required');
    }
  }

  private validateAdminStatus(status?: string) {
    if (!ADMISSIONS_WORKFLOW_STATUSES.includes(status as AdmissionsWorkflowStatus)) {
      throw new BadRequestException('Invalid application status');
    }
  }

  private hasText(value?: string) {
    return typeof value === 'string' && value.trim().length > 0;
  }
}


