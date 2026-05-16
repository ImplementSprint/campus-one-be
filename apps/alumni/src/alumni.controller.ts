import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AlumniService } from './alumni.service';
import { RegisterAlumniDto } from './dto/register-alumni.dto';
import { RequestRecordDto } from './dto/request-record.dto';
import { CardApplicationDto } from './dto/card-application.dto';
import { AlumniManifest } from './alumni.manifest';

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

  // ─── Alumni User endpoints ────────────────────────────────────────────────

  /**
   * POST /api/v1/alumni/register
   * Registers an alumnus. Writes to alumni.reg_activity_logs then alumni.accounts.
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
    return this.alumniService.requestRecord(dto);
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

  // ─── Admin endpoints (all records, not scoped to one user) ───────────────

  /**
   * GET /api/v1/alumni/admin/registry
   * Returns all alumni registration logs. Used by Alumni Admin dashboard.
   */
  @Get('admin/registry')
  async adminRegistry() {
    return this.alumniService.getAllRegistrations();
  }

  /**
   * GET /api/v1/alumni/admin/requests
   * Returns all document requests. Used by Alumni Admin dashboard.
   */
  @Get('admin/requests')
  async adminRequests() {
    return this.alumniService.getAllRecordRequests();
  }

  /**
   * PATCH /api/v1/alumni/admin/requests/:log_id
   * Updates the status_code of a document request (e.g. admin advances it).
   */
  @Patch('admin/requests/:log_id')
  async adminUpdateRequest(
    @Param('log_id') log_id: string,
    @Body() body: { status_code: number },
  ) {
    return this.alumniService.updateRecordStatus(log_id, body.status_code);
  }
}
