import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { BadRequestException, RequestMethod, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ProfessorController } from './professor.controller';

let calls = 0;

process.env.CAMPUS_ONE_AUTH_SECRET = 'test-secret-with-enough-length';

function signTestToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.CAMPUS_ONE_AUTH_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const professorAuth = [`Bearer ${signTestToken({ sub: 'professor-123', role: 'professor' })}`, 'professor', 'professor-123', 'school-a'] as const;

const service = {
  async getClasses(professorId: string) {
    calls += 1;
    return { professorId, classes: [{ id: 'class-123' }] };
  },
  async getRoster(professorId: string, classId: string) {
    calls += 1;
    return { professorId, classId, students: [{ enrollmentId: 'enrollment-123' }] };
  },
  async getSchedule(professorId: string) {
    calls += 1;
    return { professorId, schedule: [{ classId: 'class-123' }] };
  },
  async getAnnouncements(professorId: string, classId: string) {
    calls += 1;
    return { professorId, classId, announcements: [{ id: 'announcement-123' }] };
  },
  async createAnnouncement(professorId: string, classId: string, payload: any) {
    calls += 1;
    return { professorId, classId, announcement: { id: 'announcement-123', title: payload.title } };
  },
  async updateAnnouncement(professorId: string, announcementId: string, payload: any) {
    calls += 1;
    return { professorId, announcement: { id: announcementId, is_pinned: payload.is_pinned } };
  },
  async deleteAnnouncement(professorId: string, announcementId: string) {
    calls += 1;
    return { professorId, announcementId, deleted: true };
  },
};

async function expectBadRequest(operation: () => Promise<unknown>, expectedMessage: string) {
  await rejects(operation, (error: unknown) => (
    error instanceof BadRequestException &&
    error.getStatus() === 400 &&
    error.message === expectedMessage
  ));
}

async function run() {
  equal(Reflect.getMetadata(PATH_METADATA, ProfessorController), 'professor');
  equal(Reflect.getMetadata(PATH_METADATA, ProfessorController.prototype.getClasses), ':professorId/classes');
  equal(Reflect.getMetadata(METHOD_METADATA, ProfessorController.prototype.getClasses), RequestMethod.GET);
  equal(Reflect.getMetadata(PATH_METADATA, ProfessorController.prototype.getRoster), ':professorId/classes/:classId/roster');
  equal(Reflect.getMetadata(METHOD_METADATA, ProfessorController.prototype.getRoster), RequestMethod.GET);
  equal(Reflect.getMetadata(PATH_METADATA, ProfessorController.prototype.getSchedule), ':professorId/schedule');
  equal(Reflect.getMetadata(METHOD_METADATA, ProfessorController.prototype.getSchedule), RequestMethod.GET);
  equal(Reflect.getMetadata(PATH_METADATA, ProfessorController.prototype.getAnnouncements), ':professorId/classes/:classId/announcements');
  equal(Reflect.getMetadata(METHOD_METADATA, ProfessorController.prototype.getAnnouncements), RequestMethod.GET);
  equal(Reflect.getMetadata(PATH_METADATA, ProfessorController.prototype.createAnnouncement), ':professorId/classes/:classId/announcements');
  equal(Reflect.getMetadata(METHOD_METADATA, ProfessorController.prototype.createAnnouncement), RequestMethod.POST);
  equal(Reflect.getMetadata(PATH_METADATA, ProfessorController.prototype.updateAnnouncement), ':professorId/announcements/:announcementId');
  equal(Reflect.getMetadata(METHOD_METADATA, ProfessorController.prototype.updateAnnouncement), RequestMethod.PATCH);
  equal(Reflect.getMetadata(PATH_METADATA, ProfessorController.prototype.deleteAnnouncement), ':professorId/announcements/:announcementId');
  equal(Reflect.getMetadata(METHOD_METADATA, ProfessorController.prototype.deleteAnnouncement), RequestMethod.DELETE);

  const controller = new ProfessorController(service as any);

  equal((await controller.getClasses('professor-123', ...professorAuth)).classes.length, 1);
  equal((await controller.getRoster('professor-123', 'class-123', ...professorAuth)).students.length, 1);
  equal((await controller.getSchedule('professor-123', ...professorAuth)).schedule.length, 1);
  equal((await controller.getAnnouncements('professor-123', 'class-123', ...professorAuth)).announcements.length, 1);
  equal((await controller.createAnnouncement('professor-123', 'class-123', {
    title: 'Exam reminder',
    content: 'Bring your permit.',
  }, ...professorAuth)).announcement.title, 'Exam reminder');
  equal((await controller.updateAnnouncement('professor-123', 'announcement-123', {
    is_pinned: true,
  }, ...professorAuth)).announcement.is_pinned, true);
  equal((await controller.deleteAnnouncement('professor-123', 'announcement-123', ...professorAuth)).deleted, true);

  await expectBadRequest(
    () => controller.getClasses(' ', ...professorAuth),
    'professor id is required',
  );
  await expectBadRequest(
    () => controller.getSchedule(' ', ...professorAuth),
    'professor id is required',
  );
  await expectBadRequest(
    () => controller.getRoster('professor-123', ' ', ...professorAuth),
    'class id is required',
  );
  await expectBadRequest(
    () => controller.getAnnouncements('professor-123', ' ', ...professorAuth),
    'class id is required',
  );
  await expectBadRequest(
    () => controller.createAnnouncement('professor-123', 'class-123', { title: '', content: 'Body' }, ...professorAuth),
    'announcement title is required',
  );
  await expectBadRequest(
    () => controller.createAnnouncement('professor-123', 'class-123', { title: 'Title', content: ' ' }, ...professorAuth),
    'announcement content is required',
  );
  await expectBadRequest(
    () => controller.updateAnnouncement('professor-123', 'announcement-123', {}, ...professorAuth),
    'at least one announcement field is required',
  );
  await expectBadRequest(
    () => controller.deleteAnnouncement('professor-123', ' ', ...professorAuth),
    'announcement id is required',
  );

  equal(calls, 7);

  await rejects(
    () => controller.getClasses('professor-123'),
    UnauthorizedException,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
