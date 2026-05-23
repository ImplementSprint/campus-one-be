import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { RequestMethod, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ProfileController } from './profile.controller';

let serviceCalls = 0;
let lastProfileUserId: string | undefined;
let lastUpdate: { userId: string; body: unknown } | undefined;
const service = {
  async getProfile(userId: string) {
    serviceCalls += 1;
    lastProfileUserId = userId;
    return { accountType: 'student', studentNumber: 'S-2026-0001' };
  },
  async updateProfile(userId: string, body: unknown) {
    serviceCalls += 1;
    lastUpdate = { userId, body };
    return { id: userId, ...(body as Record<string, unknown>) };
  },
};

async function expectUnauthorized(operation: () => Promise<unknown>) {
  await rejects(operation, (error: unknown) => {
    return error instanceof UnauthorizedException && error.getStatus() === 401;
  });
}

async function run() {
  equal(Reflect.getMetadata(PATH_METADATA, ProfileController), 'profile');
  equal(Reflect.getMetadata(PATH_METADATA, ProfileController.prototype.getCurrentProfile), 'me');
  equal(Reflect.getMetadata(METHOD_METADATA, ProfileController.prototype.getCurrentProfile), RequestMethod.GET);
  equal(Reflect.getMetadata(PATH_METADATA, ProfileController.prototype.updateCurrentProfile), 'me');
  equal(Reflect.getMetadata(METHOD_METADATA, ProfileController.prototype.updateCurrentProfile), RequestMethod.PUT);

  const controller = new ProfileController(service as any);

  await expectUnauthorized(() => (controller.getProfile as any)('student-123', undefined));
  await expectUnauthorized(() => (controller.getProfile as any)('student-123', '   '));
  await expectUnauthorized(() => (controller.updateProfile as any)('student-123', {}, undefined));
  await expectUnauthorized(() => (controller.updateProfile as any)('student-123', {}, '   '));
  await expectUnauthorized(() => (controller.getCurrentProfile as any)(undefined));
  await expectUnauthorized(() => (controller.updateCurrentProfile as any)({}, '   '));

  equal((await controller.getCurrentProfile('student-123')).studentNumber, 'S-2026-0001');
  equal(lastProfileUserId, 'student-123');

  await controller.updateCurrentProfile({ first_name: 'Ana' }, 'student-123');
  equal(lastUpdate?.userId, 'student-123');
  equal((lastUpdate?.body as any).first_name, 'Ana');

  equal(serviceCalls, 2);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
