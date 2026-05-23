import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { NotificationsController } from './notifications.controller';

let calls = 0;
const service = {
  async list(profileId: string) {
    calls += 1;
    return [{ id: 'notification-1', profile_id: profileId }];
  },
  async create(payload: any) {
    calls += 1;
    return { id: 'notification-1', title: payload.title };
  },
  async markRead(profileId: string, notificationId: string) {
    calls += 1;
    return { id: notificationId, profile_id: profileId, is_read: true };
  },
  async markAllRead(profileId: string) {
    calls += 1;
    return { profileId, updated: true };
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
  equal(Reflect.getMetadata(PATH_METADATA, NotificationsController), 'notifications');
  equal(Reflect.getMetadata(PATH_METADATA, NotificationsController.prototype.list), ':profileId');
  equal(Reflect.getMetadata(METHOD_METADATA, NotificationsController.prototype.list), RequestMethod.GET);
  equal(Reflect.getMetadata(PATH_METADATA, NotificationsController.prototype.create), ':profileId');
  equal(Reflect.getMetadata(METHOD_METADATA, NotificationsController.prototype.create), RequestMethod.POST);
  equal(Reflect.getMetadata(PATH_METADATA, NotificationsController.prototype.markRead), ':profileId/:notificationId/read');
  equal(Reflect.getMetadata(METHOD_METADATA, NotificationsController.prototype.markRead), RequestMethod.PATCH);
  equal(Reflect.getMetadata(PATH_METADATA, NotificationsController.prototype.markAllRead), ':profileId/read-all');
  equal(Reflect.getMetadata(METHOD_METADATA, NotificationsController.prototype.markAllRead), RequestMethod.PATCH);

  const controller = new NotificationsController(service as any);
  equal((await controller.list('profile-1')).notifications.length, 1);
  equal((await controller.create('profile-1', { title: 'Hello' })).notification.title, 'Hello');
  equal((await controller.markRead('profile-1', 'notification-1')).notification.is_read, true);
  equal((await controller.markAllRead('profile-1')).updated, true);

  await expectBadRequest(() => controller.list(' '), 'profile id is required');
  await expectBadRequest(() => controller.create('profile-1', { title: '' }), 'notification title is required');
  await expectBadRequest(() => controller.markRead('profile-1', ' '), 'notification id is required');

  equal(calls, 4);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
