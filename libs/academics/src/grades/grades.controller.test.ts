import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { BadRequestException, RequestMethod, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { GradesController } from './grades.controller';

let serviceCalls = 0;
let savedPayload: unknown;
let submittedPayload: unknown;

process.env.CAMPUS_ONE_AUTH_SECRET = 'test-secret-with-enough-length';

function signTestToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.CAMPUS_ONE_AUTH_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const professorAuth = [`Bearer ${signTestToken({ sub: 'professor-123', role: 'professor' })}`, 'professor', 'professor-123', 'school-a'] as const;
const studentAuth = [`Bearer ${signTestToken({ sub: 'student-123', role: 'student' })}`, 'student', 'student-123', 'school-a'] as const;

const service = {
  async getProfessorGradebook(professorId: string, classAssignmentId: string) {
    serviceCalls += 1;
    return { professorId, classAssignmentId, students: [] };
  },
  async saveProfessorGrade(payload: unknown) {
    serviceCalls += 1;
    savedPayload = payload;
    return { success: true, status: 'saved' };
  },
  async submitProfessorGrade(payload: unknown) {
    serviceCalls += 1;
    submittedPayload = payload;
    return { success: true, status: 'submitted' };
  },
  async getSummary(userId: string) {
    serviceCalls += 1;
    return { userId, totalUnits: 12, gwa: '1.75', status: 'good_standing' };
  },
  async getTermSummary(userId: string, term: string) {
    serviceCalls += 1;
    return { userId, term, totalUnits: 6, gwa: '1.50', status: 'good_standing' };
  },
  async getGrades(userId: string) {
    serviceCalls += 1;
    return { userId, grades: [{ code: 'CS101' }] };
  },
  async getDeficiencies(userId: string) {
    serviceCalls += 1;
    return [{ userId, code: 'CS102' }];
  },
  async getGraduation(userId: string) {
    serviceCalls += 1;
    return { userId, grades: [] };
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
  const controllerPath = Reflect.getMetadata(PATH_METADATA, GradesController);
  const gradebookPath = Reflect.getMetadata(PATH_METADATA, GradesController.prototype.getProfessorGradebook);
  const gradebookMethod = Reflect.getMetadata(METHOD_METADATA, GradesController.prototype.getProfessorGradebook);
  const savePath = Reflect.getMetadata(PATH_METADATA, GradesController.prototype.saveProfessorGrade);
  const saveMethod = Reflect.getMetadata(METHOD_METADATA, GradesController.prototype.saveProfessorGrade);
  const submitPath = Reflect.getMetadata(PATH_METADATA, GradesController.prototype.submitProfessorGrade);
  const submitMethod = Reflect.getMetadata(METHOD_METADATA, GradesController.prototype.submitProfessorGrade);
  const summaryPath = Reflect.getMetadata(PATH_METADATA, GradesController.prototype.getSummary);
  const termSummaryPath = Reflect.getMetadata(PATH_METADATA, GradesController.prototype.getTermSummary);
  const gradesPath = Reflect.getMetadata(PATH_METADATA, GradesController.prototype.getGrades);
  const deficienciesPath = Reflect.getMetadata(PATH_METADATA, GradesController.prototype.getDeficiencies);
  const graduationPath = Reflect.getMetadata(PATH_METADATA, GradesController.prototype.getGraduation);

  equal(controllerPath, 'grades');
  equal(gradebookPath, 'professor/:professorId/class/:classAssignmentId');
  equal(gradebookMethod, RequestMethod.GET);
  equal(savePath, 'professor/save');
  equal(saveMethod, RequestMethod.POST);
  equal(submitPath, 'professor/submit');
  equal(submitMethod, RequestMethod.POST);
  equal(summaryPath, ':userId/summary');
  equal(termSummaryPath, ':userId/terms/:term/summary');
  equal(gradesPath, ':userId');
  equal(deficienciesPath, ':userId/deficiencies');
  equal(graduationPath, ':userId/graduation');

  const controller = new GradesController(service as any);

  const gradebook = await controller.getProfessorGradebook('professor-123', 'class-456', ...professorAuth);
  equal(gradebook.professorId, 'professor-123');
  equal(gradebook.classAssignmentId, 'class-456');

  const savePayload = {
    professorId: 'professor-123',
    enrollmentId: 'enrollment-123',
    prelimGrade: 89,
  };
  const saveResult = await controller.saveProfessorGrade(savePayload, ...professorAuth);
  equal(saveResult.status, 'saved');
  equal(savedPayload, savePayload);

  const submitPayload = {
    professorId: 'professor-123',
    enrollmentId: 'enrollment-123',
    finalGrade: 91,
    letterGrade: 'A',
    remarks: 'Passed',
  };
  const submitResult = await controller.submitProfessorGrade(submitPayload, ...professorAuth);
  equal(submitResult.status, 'submitted');
  equal(submittedPayload, submitPayload);

  equal((await controller.getSummary('student-123', ...studentAuth)).gwa, '1.75');
  equal((await controller.getTermSummary('student-123', '1st-semester', ...studentAuth)).term, '1st-semester');
  equal((await controller.getGrades('student-123', ...studentAuth)).grades.length, 1);
  equal((await controller.getDeficiencies('student-123', ...studentAuth)).length, 1);
  equal((await controller.getGraduation('student-123', ...studentAuth)).grades.length, 0);

  await expectBadRequest(
    () => (controller.saveProfessorGrade as any)(undefined, ...professorAuth),
    'Missing required fields: professorId, enrollmentId, and at least one grade value',
  );
  await expectBadRequest(
    () => controller.saveProfessorGrade({ professorId: 'professor-123', enrollmentId: 'enrollment-123' }, ...professorAuth),
    'Missing required fields: professorId, enrollmentId, and at least one grade value',
  );
  await expectBadRequest(
    () => (controller.submitProfessorGrade as any)({ professorId: 'professor-123', enrollmentId: 'enrollment-123' }, ...professorAuth),
    'Missing required fields: professorId, enrollmentId, finalGrade, letterGrade, and remarks',
  );

  equal(serviceCalls, 8);

  await rejects(
    () => controller.getProfessorGradebook('professor-123', 'class-456'),
    UnauthorizedException,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
