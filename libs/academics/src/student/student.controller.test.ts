import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { StudentController } from './student.controller';

let serviceCalls = 0;
let updatedStatus: unknown;
let updatedInfo: unknown;
let requestedStudentId: string | undefined;

const service = {
  getHealth() {
    serviceCalls += 1;
    return { status: 'ok', service: 'student', version: '1.0.0' };
  },
  async getStats() {
    serviceCalls += 1;
    return { total: 3, active: 2, inactive: 1, pending: 0 };
  },
  async findAll() {
    serviceCalls += 1;
    return [{ id: 'student-123' }];
  },
  async findOne(id: string) {
    serviceCalls += 1;
    return { id };
  },
  async updateStatus(id: string, dto: unknown) {
    serviceCalls += 1;
    updatedStatus = { id, dto };
    return { id, ...(dto as Record<string, unknown>) };
  },
  async updateInfo(id: string, dto: unknown) {
    serviceCalls += 1;
    updatedInfo = { id, dto };
    return { id, ...(dto as Record<string, unknown>) };
  },
  async getEnrolledCourses(id: string) {
    requestedStudentId = id;
    return [{ id: 'enrollment-1' }];
  },
  async getClassSchedule(id: string) {
    requestedStudentId = id;
    return [{ id: 'class-1' }];
  },
  async getCurriculumProgress(id: string) {
    requestedStudentId = id;
    return { studentId: id, completedUnits: 42 };
  },
  async getHoldsAndDeficiencies(id: string) {
    requestedStudentId = id;
    return { holds: [], deficiencies: [] };
  },
  async getAnnouncements(id: string) {
    requestedStudentId = id;
    return [{ id: 'announcement-1' }];
  },
};

async function expectBadRequest(operation: () => Promise<unknown>, expectedMessage: string) {
  await rejects(operation, (error: unknown) => {
    return (
      error instanceof BadRequestException &&
      error.getStatus() === 400 &&
      error.message === expectedMessage
    );
  });
}

async function run() {
  const controllerPath = Reflect.getMetadata(PATH_METADATA, StudentController);
  const healthPath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.health);
  const statsPath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.getStats);
  const listPath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.findAll);
  const detailPath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.findOne);
  const statusPath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.updateStatus);
  const infoPath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.updateInfo);
  const enrolledCoursesPath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.getEnrolledCourses);
  const classSchedulePath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.getClassSchedule);
  const curriculumProgressPath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.getCurriculumProgress);
  const holdsPath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.getHoldsAndDeficiencies);
  const announcementsPath = Reflect.getMetadata(PATH_METADATA, StudentController.prototype.getAnnouncements);

  equal(controllerPath, 'v1/student');
  equal(healthPath, 'health');
  equal(statsPath, 'stats');
  equal(listPath, '/');
  equal(detailPath, ':id');
  equal(statusPath, ':id/status');
  equal(infoPath, ':id');
  equal(enrolledCoursesPath, ':id/enrolled-courses');
  equal(classSchedulePath, ':id/class-schedule');
  equal(curriculumProgressPath, ':id/curriculum-progress');
  equal(holdsPath, ':id/holds-deficiencies');
  equal(announcementsPath, ':id/announcements');

  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.health), RequestMethod.GET);
  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.getStats), RequestMethod.GET);
  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.findAll), RequestMethod.GET);
  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.findOne), RequestMethod.GET);
  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.updateStatus), RequestMethod.PATCH);
  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.updateInfo), RequestMethod.PATCH);
  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.getEnrolledCourses), RequestMethod.GET);
  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.getClassSchedule), RequestMethod.GET);
  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.getCurriculumProgress), RequestMethod.GET);
  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.getHoldsAndDeficiencies), RequestMethod.GET);
  equal(Reflect.getMetadata(METHOD_METADATA, StudentController.prototype.getAnnouncements), RequestMethod.GET);

  const controller = new StudentController(service as any);

  equal(controller.health().service, 'student');
  equal((await controller.getStats()).active, 2);
  equal((await controller.findAll()).length, 1);
  equal((await controller.findOne('student-123')).id, 'student-123');

  await expectBadRequest(
    () => controller.findOne(' '),
    'student id is required',
  );
  await expectBadRequest(
    () => (controller.updateStatus as any)('student-123', undefined),
    'enrollment_status must be active or inactive',
  );
  await expectBadRequest(
    () => controller.updateStatus('student-123', { enrollment_status: 'pending' as any }),
    'enrollment_status must be active or inactive',
  );
  await expectBadRequest(
    () => controller.updateInfo('student-123', {}),
    'At least one of email or student_number is required',
  );
  await expectBadRequest(
    () => controller.updateInfo(' ', { email: 'student@example.test' }),
    'student id is required',
  );

  await controller.updateStatus('student-123', { enrollment_status: 'active' });
  await controller.updateInfo('student-123', { email: 'student@example.test' });
  equal((await controller.getEnrolledCourses('student-123')).length, 1);
  equal((await controller.getClassSchedule('student-123')).length, 1);
  equal((await controller.getCurriculumProgress('student-123')).completedUnits, 42);
  equal((await controller.getHoldsAndDeficiencies('student-123')).holds.length, 0);
  equal((await controller.getAnnouncements('student-123')).length, 1);

  equal((updatedStatus as any).id, 'student-123');
  equal((updatedStatus as any).dto.enrollment_status, 'active');
  equal((updatedInfo as any).dto.email, 'student@example.test');
  equal(requestedStudentId, 'student-123');
  equal(serviceCalls, 6);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
