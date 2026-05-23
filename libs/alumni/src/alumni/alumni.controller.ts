import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AlumniService } from './alumni.service';
import { RegisterAlumniDto } from './dto/register-alumni.dto';
import { RequestRecordDto } from './dto/request-record.dto';
import { CardApplicationDto } from './dto/card-application.dto';
import { AlumniManifest } from './alumni.manifest';
import { DocumentType } from './interfaces/alumni.interface';
import { authorizeRoute } from '../../../auth/src/platform-auth/route-authorization';

@Controller('alumni')
export class AlumniController {
  constructor(private readonly alumniService: AlumniService) {}

  /**
   * GET /api/v1/alumni/health
   */
  @Get('health')
  health(): { status: string; service: string; version: string } {
    return {
      status: 'ok',
      service: AlumniManifest.id,
      version: AlumniManifest.version,
    };
  }

  // â”€â”€â”€ Alumni User endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * POST /api/v1/alumni/register
  * Registers an alumnus. Writes to alumni.alumni_reg_activity_logs then alumni.
   * Event fired: alumni.registration.submitted.v1
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterAlumniDto) {
    return this.alumniService.registerAlumni(dto);
  }

  /**
   * GET /api/v1/alumni/profile/:actor_uuid
   * Returns the most recent registration log entry for the given alumnus.
   */
  @Get('profile/:actor_uuid')
  async getProfile(@Param('actor_uuid') actor_uuid: string) {
    return this.alumniService.getAlumniProfile(actor_uuid);
  }

  /**
   * POST /api/v1/alumni/records/request
   * Submits a document request (TOR, Diploma, Good Moral, Certificate).
   * Fee is auto-calculated server-side; payment starts as pending.
   * Event fired: alumni.record.requested.v1
   */
  @Post('records/request')
  @HttpCode(HttpStatus.CREATED)
  async requestRecord(@Body() dto: RequestRecordDto) {
    this.validateRecordRequest(dto);
    return this.alumniService.requestRecord(dto);
  }

  @Get('records/fee/:document_type')
  calculateRecordFee(
    @Param('document_type') document_type: DocumentType,
    @Query('copies') copies?: string,
  ) {
    if (!Object.values(DocumentType).includes(document_type)) {
      throw new BadRequestException('Invalid document type');
    }
    const parsedCopies = copies === undefined ? undefined : Number(copies);
    if (parsedCopies !== undefined && (!Number.isInteger(parsedCopies) || parsedCopies < 1)) {
      throw new BadRequestException('Invalid copy count');
    }
    return this.alumniService.calculateRecordFee(document_type, parsedCopies);
  }

  /**
   * GET /api/v1/alumni/records/:actor_uuid
   * Returns all document requests for an alumnus, ordered newest first.
   */
  @Get('records/:actor_uuid')
  async getRecords(@Param('actor_uuid') actor_uuid: string) {
    return this.alumniService.getRecordRequests(actor_uuid);
  }

  /**
   * POST /api/v1/alumni/card-request
  * Submits an ID card application. Writes to alumni.card_applications.
   */
  @Post('card-request')
  @HttpCode(HttpStatus.CREATED)
  async applyForCard(@Body() dto: CardApplicationDto) {
    return this.alumniService.applyForCard(dto);
  }

  /**
   * GET /api/v1/alumni/card-request/:actor_uuid
   * Returns all card applications for an alumnus.
   */
  @Get('card-request/:actor_uuid')
  async getCardApplications(@Param('actor_uuid') actor_uuid: string) {
    return this.alumniService.getCardApplications(actor_uuid);
  }

  @Get('communication-log/:actor_uuid')
  async getCommunicationLog(@Param('actor_uuid') actor_uuid: string) {
    return this.alumniService.getCommunicationLog(actor_uuid);
  }

  // â”€â”€â”€ Admin endpoints (all records, not scoped to one user) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * GET /api/v1/alumni/admin/registry
   * Returns all alumni registration logs. Used by Alumni Admin dashboard.
   */
  @Get('admin/registry')
  async adminRegistry(
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['alumni_admin', 'super_admin'] });
    return this.alumniService.getAllRegistrations();
  }

  /**
   * GET /api/v1/alumni/admin/requests
   * Returns all document requests. Used by Alumni Admin dashboard.
   */
  @Get('admin/requests')
  async adminRequests(
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['alumni_admin', 'super_admin'] });
    return this.alumniService.getAllRecordRequests();
  }

  @Get('admin/card-requests')
  async adminCardRequests(
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['alumni_admin', 'super_admin'] });
    return this.alumniService.getAllCardApplications();
  }

  /**
   * PATCH /api/v1/alumni/admin/requests/:log_id
   * Updates the status_code of a document request (e.g. admin advances it).
   */
  @Patch('admin/requests/:log_id')
  async adminUpdateRequest(
    @Param('log_id') log_id: string,
    @Body() body: { status_code: number; payment_status?: 'pending' | 'paid' },
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['alumni_admin', 'super_admin'] });
    this.validateRequestStatus(body);
    return this.alumniService.updateRecordStatus(log_id, body.status_code, body.payment_status);
  }

  @Patch('admin/card-requests/:log_id')
  async adminUpdateCardRequest(
    @Param('log_id') log_id: string,
    @Body() body: { status_code: number; payment_status?: 'pending' | 'paid' },
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['alumni_admin', 'super_admin'] });
    this.validateRequestStatus(body);
    return this.alumniService.updateCardApplicationStatus(log_id, body.status_code, body.payment_status);
  }

  private validateRecordRequest(dto: RequestRecordDto) {
    const isValidDocumentType = Object.values(DocumentType).includes(dto?.document_type);
    const isValidCopyCount =
      dto?.number_of_copies === undefined ||
      (Number.isInteger(dto.number_of_copies) && dto.number_of_copies >= 1);
    const isValidDeliveryMethod =
      dto?.delivery_method === undefined ||
      ['pickup', 'delivery', 'courier'].includes(dto.delivery_method);

    if (!dto?.actor_uuid || !dto?.tenant_id || !isValidDocumentType || !isValidCopyCount || !isValidDeliveryMethod) {
      throw new BadRequestException('Invalid document request payload');
    }
  }

  private validateRequestStatus(body: { status_code: number; payment_status?: string }) {
    const validPaymentStatus =
      body?.payment_status === undefined ||
      body.payment_status === 'pending' ||
      body.payment_status === 'paid';
    if (!Number.isInteger(body?.status_code) || !validPaymentStatus) {
      throw new BadRequestException('Invalid request status payload');
    }
  }
}


