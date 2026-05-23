import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { authorizeRoute } from '../../../auth/src/platform-auth/route-authorization';
import { ProfessorService } from './professor.service';

@Controller('professor')
export class ProfessorController {
  constructor(private readonly professorService: ProfessorService) {}

  @Get(':professorId/classes')
  async getClasses(
    @Param('professorId') professorId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeProfessor(authorization, role, userId, institutionId, schoolSlug);
    if (!professorId?.trim()) {
      throw new BadRequestException('professor id is required');
    }

    return this.professorService.getClasses(professorId);
  }

  @Get(':professorId/schedule')
  async getSchedule(
    @Param('professorId') professorId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeProfessor(authorization, role, userId, institutionId, schoolSlug);
    if (!professorId?.trim()) {
      throw new BadRequestException('professor id is required');
    }

    return this.professorService.getSchedule(professorId);
  }

  @Get(':professorId/classes/:classId/announcements')
  async getAnnouncements(
    @Param('professorId') professorId: string,
    @Param('classId') classId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeProfessor(authorization, role, userId, institutionId, schoolSlug);
    this.validateProfessorId(professorId);
    this.validateClassId(classId);

    return this.professorService.getAnnouncements(professorId, classId);
  }

  @Post(':professorId/classes/:classId/announcements')
  async createAnnouncement(
    @Param('professorId') professorId: string,
    @Param('classId') classId: string,
    @Body() payload: {
      title?: string;
      content?: string;
      announcement_type?: string;
      is_pinned?: boolean;
    },
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeProfessor(authorization, role, userId, institutionId, schoolSlug);
    this.validateProfessorId(professorId);
    this.validateClassId(classId);
    if (!payload?.title?.trim()) {
      throw new BadRequestException('announcement title is required');
    }
    if (!payload?.content?.trim()) {
      throw new BadRequestException('announcement content is required');
    }

    return this.professorService.createAnnouncement(professorId, classId, payload);
  }

  @Patch(':professorId/announcements/:announcementId')
  async updateAnnouncement(
    @Param('professorId') professorId: string,
    @Param('announcementId') announcementId: string,
    @Body() payload: {
      title?: string;
      content?: string;
      announcement_type?: string;
      is_pinned?: boolean;
    },
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeProfessor(authorization, role, userId, institutionId, schoolSlug);
    this.validateProfessorId(professorId);
    this.validateAnnouncementId(announcementId);
    const allowedKeys = ['title', 'content', 'announcement_type', 'is_pinned'];
    if (!payload || !allowedKeys.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) {
      throw new BadRequestException('at least one announcement field is required');
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'title') && !payload.title?.trim()) {
      throw new BadRequestException('announcement title is required');
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'content') && !payload.content?.trim()) {
      throw new BadRequestException('announcement content is required');
    }

    return this.professorService.updateAnnouncement(professorId, announcementId, payload);
  }

  @Delete(':professorId/announcements/:announcementId')
  async deleteAnnouncement(
    @Param('professorId') professorId: string,
    @Param('announcementId') announcementId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeProfessor(authorization, role, userId, institutionId, schoolSlug);
    this.validateProfessorId(professorId);
    this.validateAnnouncementId(announcementId);

    return this.professorService.deleteAnnouncement(professorId, announcementId);
  }

  @Get(':professorId/classes/:classId/roster')
  async getRoster(
    @Param('professorId') professorId: string,
    @Param('classId') classId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-institution-id') institutionId?: string,
    @Headers('x-school-slug') schoolSlug?: string,
  ) {
    this.authorizeProfessor(authorization, role, userId, institutionId, schoolSlug);
    if (!professorId?.trim()) {
      throw new BadRequestException('professor id is required');
    }
    if (!classId?.trim()) {
      throw new BadRequestException('class id is required');
    }

    return this.professorService.getRoster(professorId, classId);
  }

  private validateProfessorId(professorId: string) {
    if (!professorId?.trim()) {
      throw new BadRequestException('professor id is required');
    }
  }

  private validateClassId(classId: string) {
    if (!classId?.trim()) {
      throw new BadRequestException('class id is required');
    }
  }

  private validateAnnouncementId(announcementId: string) {
    if (!announcementId?.trim()) {
      throw new BadRequestException('announcement id is required');
    }
  }

  private authorizeProfessor(authorization?: string, role?: string, userId?: string, institutionId?: string, schoolSlug?: string) {
    return authorizeRoute({ authorization, role, userId, institutionId, schoolSlug, allowedRoles: ['professor', 'super_admin'] });
  }
}
