import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Headers, HttpCode, HttpStatus, HttpException } from '@nestjs/common';
import { InstitutionDataService } from './institution-data.service';

@Controller()
export class InstitutionDataController {
  constructor(private readonly svc: InstitutionDataService) {}

  private uid(headers: Record<string, string>): string {
    const id = headers['x-user-id'];
    if (!id) throw new HttpException('Missing x-user-id header', HttpStatus.UNAUTHORIZED);
    return id;
  }

  // ─── Resources ───────────────────────────────────────────────────────────────

  @Get('resources/:resource')
  async list(
    @Param('resource') resource: string,
    @Query('search') search: string,
    @Headers() headers: Record<string, string>,
  ) {
    try { return await this.svc.list(this.uid(headers), resource, search); }
    catch (e: any) { throw new HttpException(e.message, e.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Post('resources/:resource')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('resource') resource: string,
    @Body() body: Record<string, string>,
    @Headers() headers: Record<string, string>,
  ) {
    try { return await this.svc.create(this.uid(headers), resource, body); }
    catch (e: any) { throw new HttpException(e.message, e.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Patch('resources/:resource/:id')
  async update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: Record<string, string>,
    @Headers() headers: Record<string, string>,
  ) {
    try { return await this.svc.update(this.uid(headers), resource, id, body); }
    catch (e: any) { throw new HttpException(e.message, e.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Delete('resources/:resource/:id')
  async remove(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string>,
  ) {
    try { return await this.svc.remove(this.uid(headers), resource, id); }
    catch (e: any) { throw new HttpException(e.message, e.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  // ─── Notifications ───────────────────────────────────────────────────────────

  @Patch('notifications/read-all')
  async markAllNotificationsRead(@Headers() headers: Record<string, string>) {
    try { return await this.svc.markAllNotificationsRead(this.uid(headers)); }
    catch (e: any) { throw new HttpException(e.message, e.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────────

  @Get('dashboard')
  async dashboard(@Headers() headers: Record<string, string>) {
    try { return await this.svc.dashboard(this.uid(headers)); }
    catch (e: any) { throw new HttpException(e.message, e.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  // ─── School Profile ──────────────────────────────────────────────────────────

  @Get('school/profile')
  async getProfile(@Headers() headers: Record<string, string>) {
    try { return await this.svc.getProfile(this.uid(headers)); }
    catch (e: any) { throw new HttpException(e.message, e.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Patch('school/profile')
  async updateProfile(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    try { return await this.svc.updateProfile(this.uid(headers), body); }
    catch (e: any) { throw new HttpException(e.message, e.status ?? HttpStatus.INTERNAL_SERVER_ERROR); }
  }
}
