import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get(':profileId')
  async list(@Param('profileId') profileId: string) {
    this.validateProfileId(profileId);
    return { notifications: await this.notificationsService.list(profileId) };
  }

  @Post(':profileId')
  async create(
    @Param('profileId') profileId: string,
    @Body() body: { title?: string; body?: string; metadata?: Record<string, unknown> },
  ) {
    this.validateProfileId(profileId);
    if (!body?.title?.trim()) throw new BadRequestException('notification title is required');

    return {
      notification: await this.notificationsService.create({
        profileId,
        title: body.title.trim(),
        body: body.body ?? null,
        metadata: body.metadata,
      }),
    };
  }

  @Patch(':profileId/:notificationId/read')
  async markRead(
    @Param('profileId') profileId: string,
    @Param('notificationId') notificationId: string,
  ) {
    this.validateProfileId(profileId);
    if (!notificationId?.trim()) throw new BadRequestException('notification id is required');
    return { notification: await this.notificationsService.markRead(profileId, notificationId) };
  }

  @Patch(':profileId/read-all')
  async markAllRead(@Param('profileId') profileId: string) {
    this.validateProfileId(profileId);
    return this.notificationsService.markAllRead(profileId);
  }

  private validateProfileId(profileId: string) {
    if (!profileId?.trim()) throw new BadRequestException('profile id is required');
  }
}
