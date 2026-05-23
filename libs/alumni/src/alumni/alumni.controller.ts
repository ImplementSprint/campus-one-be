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
import { Public } from '../../../auth/src/platform-auth/public.decorator';
import { RequirePermissions } from '../../../auth/src/platform-auth/permissions.decorator';
import { AlumniService } from './alumni.service';
import { RegisterAlumniDto } from './dto/register-alumni.dto';
import { RequestRecordDto } from './dto/request-record.dto';
import { CardApplicationDto } from './dto/card-application.dto';
import { AlumniManifest } from './alumni.manifest';

@Controller('alumni')
export class AlumniController {
  constructor(private readonly alumniService: AlumniService) {}

  @Get('health')
  @Public()
  health(): { status: string; service: string; version: string } {
    return {
      status: 'ok',
      service: AlumniManifest.id,
      version: AlumniManifest.version,
    };
  }

  @Post('register')
  @RequirePermissions('alumni.self.write')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterAlumniDto) {
    return this.alumniService.registerAlumni(dto);
  }

  @Get('profile/:actor_uuid')
  @RequirePermissions('alumni.self.write')
  async getProfile(@Param('actor_uuid') actor_uuid: string) {
    return this.alumniService.getAlumniProfile(actor_uuid);
  }

  @Post('records/request')
  @RequirePermissions('alumni.self.write')
  @HttpCode(HttpStatus.CREATED)
  async requestRecord(@Body() dto: RequestRecordDto) {
    return this.alumniService.requestRecord(dto);
  }

  @Get('records/:actor_uuid')
  @RequirePermissions('alumni.self.write')
  async getRecords(@Param('actor_uuid') actor_uuid: string) {
    return this.alumniService.getRecordRequests(actor_uuid);
  }

  @Post('card-request')
  @RequirePermissions('alumni.self.write')
  @HttpCode(HttpStatus.CREATED)
  async applyForCard(@Body() dto: CardApplicationDto) {
    return this.alumniService.applyForCard(dto);
  }

  @Get('card-request/:actor_uuid')
  @RequirePermissions('alumni.self.write')
  async getCardApplications(@Param('actor_uuid') actor_uuid: string) {
    return this.alumniService.getCardApplications(actor_uuid);
  }

  @Get('admin/registry')
  @RequirePermissions('alumni.read')
  async adminRegistry() {
    return this.alumniService.getAllRegistrations();
  }

  @Get('admin/requests')
  @RequirePermissions('alumni.read')
  async adminRequests() {
    return this.alumniService.getAllRecordRequests();
  }

  @Patch('admin/requests/:log_id')
  @RequirePermissions('alumni.write')
  async adminUpdateRequest(
    @Param('log_id') log_id: string,
    @Body() body: { status_code: number },
  ) {
    return this.alumniService.updateRecordStatus(log_id, body.status_code);
  }
}
