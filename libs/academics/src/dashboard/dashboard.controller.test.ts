import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { RequestMethod, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DashboardController } from './dashboard.controller';

let serviceCalls = 0;
let requestedUserId: string | undefined;

const service = {
  async getDashboard(userId: string) {
    serviceCalls += 1;
    requestedUserId = userId;
    return {
      name: 'Ana Student',
      enrolledCourses: 4,
      enrolledUnits: 12,
      cartSubjects: 0,
      cartUnits: 0,
    };
  },
};

async function expectUnauthorized(operation: () => Promise<unknown>) {
  await rejects(operation, (error: unknown) => {
    return error instanceof UnauthorizedException && error.getStatus() === 401;
  });
}

async function run() {
  equal(Reflect.getMetadata(PATH_METADATA, DashboardController), 'dashboard');
  equal(Reflect.getMetadata(PATH_METADATA, DashboardController.prototype.getCurrentDashboard), 'me');
  equal(Reflect.getMetadata(METHOD_METADATA, DashboardController.prototype.getCurrentDashboard), RequestMethod.GET);

  const controller = new DashboardController(service as any);

  await expectUnauthorized(() => (controller.getCurrentDashboard as any)(undefined));
  await expectUnauthorized(() => (controller.getCurrentDashboard as any)('   '));

  const result = await controller.getCurrentDashboard('student-123');

  equal(requestedUserId, 'student-123');
  equal(result.enrolledCourses, 4);
  equal(result.enrolledUnits, 12);
  equal(serviceCalls, 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
