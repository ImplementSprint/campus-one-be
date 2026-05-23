import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { HttpStatus, RequestMethod, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';

let verifiedToken: string | undefined;

const currentUser = {
  id: 'user-1',
  email: 'owner@school.test',
  role: 'school_owner',
  permissions: ['tenant.read'],
  activeInstitutionId: 'institution-1',
};

const service = {
  signUp(body: unknown) {
    return { action: 'signUp', body };
  },
  login(body: unknown) {
    return { action: 'login', body };
  },
  signOut() {
    return { message: 'Signed out successfully.' };
  },
  async verifyAccessToken(token: string) {
    verifiedToken = token;
    return currentUser;
  },
};

async function run() {
  equal(Reflect.getMetadata(PATH_METADATA, AuthController), 'auth');

  equal(Reflect.getMetadata(PATH_METADATA, AuthController.prototype.signUp), 'signup');
  equal(Reflect.getMetadata(METHOD_METADATA, AuthController.prototype.signUp), RequestMethod.POST);
  equal(Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.signUp), HttpStatus.CREATED);

  equal(Reflect.getMetadata(PATH_METADATA, AuthController.prototype.login), 'login');
  equal(Reflect.getMetadata(METHOD_METADATA, AuthController.prototype.login), RequestMethod.POST);
  equal(Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.login), HttpStatus.OK);

  equal(Reflect.getMetadata(PATH_METADATA, AuthController.prototype.signIn), 'signin');
  equal(Reflect.getMetadata(METHOD_METADATA, AuthController.prototype.signIn), RequestMethod.POST);
  equal(Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.signIn), HttpStatus.OK);

  equal(Reflect.getMetadata(PATH_METADATA, AuthController.prototype.signOut), 'signout');
  equal(Reflect.getMetadata(METHOD_METADATA, AuthController.prototype.signOut), RequestMethod.POST);
  equal(Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.signOut), HttpStatus.OK);

  equal(Reflect.getMetadata(PATH_METADATA, AuthController.prototype.me), 'me');
  equal(Reflect.getMetadata(METHOD_METADATA, AuthController.prototype.me), RequestMethod.GET);
  equal(Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.me), HttpStatus.OK);

  const controller = new AuthController(service as any);

  equal((controller.signUp({ email: 'new@school.test' } as any) as any).action, 'signUp');
  equal((controller.login({ email: 'owner@school.test' } as any) as any).action, 'login');
  equal((controller.signIn({ email: 'owner@school.test' } as any) as any).action, 'login');
  equal((controller.signOut() as any).message, 'Signed out successfully.');

  await rejects(
    () => controller.me(undefined),
    (error: unknown) =>
      error instanceof UnauthorizedException &&
      error.message === 'Bearer token is required.',
  );

  const meResponse = await controller.me('Bearer access-token-123');
  equal(verifiedToken, 'access-token-123');
  equal(meResponse.user, currentUser);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
