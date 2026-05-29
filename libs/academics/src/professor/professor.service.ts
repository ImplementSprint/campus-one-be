import { ForbiddenException, Injectable } from '@nestjs/common';
import { supabase } from '@campus-one/database/supabase';
import { NotificationsService } from '../../../notifications/src/notifications.service';
import { PostgresAcademicsRepository } from '../academics-postgres.repository';

@Injectable()
export class ProfessorService {
  private readonly db = supabase.schema('public');
  private readonly notifications = new NotificationsService();
  private readonly postgres = new PostgresAcademicsRepository();

  async getProfile(professorId: string) {
    const { data, error } = await this.db
      .from('professor_users')
      .select('id, institution_id, email, full_name, department, employee_id, created_at, updated_at')
      .eq('id', professorId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return {
      professorId,
      profile: data ?? null,
    };
  }

  async getClasses(professorId: string, institutionId?: string) {
    if (this.usePostgres(institutionId)) {
      return this.postgres.getProfessorClasses(institutionId!, professorId);
    }

    const { data, error } = await this.db
      .from('class_assignments')
      .select('id, section, schedule, room, max_students, subjects!inner(id, code, name, description, units)')
      .eq('professor_id', professorId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const classIds = (data || []).map((item: any) => item.id);
    const enrollmentCounts = await this.getEnrollmentCounts(classIds);

    return {
      professorId,
      classes: (data || []).map((item: any) => ({
        id: item.id,
        subject: {
          id: item.subjects?.id ?? null,
          code: item.subjects?.code ?? '',
          name: item.subjects?.name ?? '',
          description: item.subjects?.description ?? '',
          units: item.subjects?.units ?? 0,
        },
        section: item.section,
        schedule: item.schedule,
        room: item.room,
        max_students: item.max_students ?? 0,
        enrolled_count: enrollmentCounts[item.id] ?? 0,
      })),
    };
  }

  async getSchedule(professorId: string, institutionId?: string) {
    const classes = await this.getClasses(professorId, institutionId);

    return {
      professorId,
      schedule: classes.classes
        .filter((classItem) => Boolean(classItem.schedule || classItem.room))
        .map((classItem) => ({
          classId: classItem.id,
          subject: classItem.subject,
          section: classItem.section,
          schedule: classItem.schedule,
          room: classItem.room,
          max_students: classItem.max_students,
          enrolled_count: classItem.enrolled_count,
        })),
    };
  }

  async getRoster(professorId: string, classId: string, institutionId?: string) {
    if (this.usePostgres(institutionId)) {
      return this.postgres.getRoster(institutionId!, professorId, classId);
    }

    await this.assertClassBelongsToProfessor(professorId, classId);

    const { data, error } = await this.db
      .from('class_enrollments')
      .select('id, enrollment_status, enrolled_at, student_accounts!inner(id, email, student_number, applicant_id, applicant_profiles(full_name))')
      .eq('class_assignment_id', classId)
      .eq('enrollment_status', 'enrolled')
      .order('enrolled_at', { ascending: true });

    if (error) throw new Error(error.message);

    return {
      professorId,
      classId,
      students: (data || []).map((enrollment: any) => ({
        enrollmentId: enrollment.id,
        status: enrollment.enrollment_status,
        enrolledAt: enrollment.enrolled_at,
        student: {
          id: enrollment.student_accounts?.id ?? '',
          email: enrollment.student_accounts?.email ?? '',
          studentNumber: enrollment.student_accounts?.student_number ?? '',
          name: enrollment.student_accounts?.applicant_profiles?.full_name ?? 'Student',
          applicantId: enrollment.student_accounts?.applicant_id ?? null,
        },
      })),
    };
  }

  async getAnnouncements(professorId: string, classId: string) {
    await this.assertClassBelongsToProfessor(professorId, classId);

    const { data, error } = await this.db
      .from('announcements')
      .select('id, title, content, announcement_type, is_pinned, created_at, updated_at')
      .eq('class_assignment_id', classId)
      .eq('is_published', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return {
      professorId,
      classId,
      announcements: data || [],
    };
  }

  async createAnnouncement(
    professorId: string,
    classId: string,
    payload: {
      title?: string;
      content?: string;
      announcement_type?: string;
      is_pinned?: boolean;
    },
  ) {
    await this.assertClassBelongsToProfessor(professorId, classId);

    const { data, error } = await this.db
      .from('announcements')
      .insert({
        class_assignment_id: classId,
        professor_id: professorId,
        title: payload.title?.trim(),
        content: payload.content?.trim(),
        announcement_type: payload.announcement_type ?? 'general',
        is_pinned: payload.is_pinned ?? false,
        is_published: true,
      })
      .select('id, title, content, announcement_type, is_pinned, created_at, updated_at')
      .single();

    if (error) throw new Error(error.message);

    await this.notifications.tryCreate({
      profileId: professorId,
      title: payload.title?.trim() ?? 'Announcement posted',
      body: payload.content?.trim() ?? null,
      metadata: {
        action: 'professor.announcement.created',
        professorId,
        classId,
        announcementId: data?.id,
      },
    });

    return {
      professorId,
      classId,
      announcement: data,
      notification: {
        type: 'professor_announcement_posted',
        professorId,
        classId,
        title: payload.title?.trim() ?? '',
        body: payload.content?.trim() ?? '',
      },
    };
  }

  async updateAnnouncement(
    professorId: string,
    announcementId: string,
    payload: {
      title?: string;
      content?: string;
      announcement_type?: string;
      is_pinned?: boolean;
    },
  ) {
    await this.assertAnnouncementBelongsToProfessor(professorId, announcementId);

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (Object.prototype.hasOwnProperty.call(payload, 'title')) updates.title = payload.title?.trim();
    if (Object.prototype.hasOwnProperty.call(payload, 'content')) updates.content = payload.content?.trim();
    if (Object.prototype.hasOwnProperty.call(payload, 'announcement_type')) updates.announcement_type = payload.announcement_type ?? 'general';
    if (Object.prototype.hasOwnProperty.call(payload, 'is_pinned')) updates.is_pinned = Boolean(payload.is_pinned);

    const { data, error } = await this.db
      .from('announcements')
      .update(updates)
      .eq('id', announcementId)
      .select('id, title, content, announcement_type, is_pinned, created_at, updated_at')
      .single();

    if (error) throw new Error(error.message);

    return {
      professorId,
      announcement: data,
    };
  }

  async deleteAnnouncement(professorId: string, announcementId: string) {
    await this.assertAnnouncementBelongsToProfessor(professorId, announcementId);

    const { error } = await this.db
      .from('announcements')
      .delete()
      .eq('id', announcementId);

    if (error) throw new Error(error.message);

    return {
      professorId,
      announcementId,
      deleted: true,
    };
  }

  private async getEnrollmentCounts(classIds: string[]) {
    if (!classIds.length) return {};

    const { data, error } = await this.db
      .from('class_enrollments')
      .select('class_assignment_id')
      .in('class_assignment_id', classIds)
      .eq('enrollment_status', 'enrolled');

    if (error) throw new Error(error.message);

    return (data || []).reduce((counts: Record<string, number>, item: any) => {
      counts[item.class_assignment_id] = (counts[item.class_assignment_id] ?? 0) + 1;
      return counts;
    }, {});
  }

  private async assertClassBelongsToProfessor(professorId: string, classId: string) {
    const { data, error } = await this.db
      .from('class_assignments')
      .select('id')
      .eq('id', classId)
      .eq('professor_id', professorId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ForbiddenException('Professor is not assigned to this class.');
  }

  private async assertAnnouncementBelongsToProfessor(professorId: string, announcementId: string) {
    const { data, error } = await this.db
      .from('announcements')
      .select('id, class_assignment_id, class_assignments!inner(professor_id)')
      .eq('id', announcementId)
      .eq('class_assignments.professor_id', professorId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ForbiddenException('Professor is not assigned to this announcement.');
  }

  private usePostgres(institutionId?: string) {
    return Boolean(institutionId?.trim() && process.env.ACADEMICS_DATABASE_URL?.trim());
  }
}
