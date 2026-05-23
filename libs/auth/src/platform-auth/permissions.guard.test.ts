import { equal, throws } from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { REQUIRED_PERMISSIONS } from './permissions.decorator';

class FakeReflector {
  constructor(private readonly required?: string[]) {}

  getAllAndOverride(key: string) {
    equal(key, REQUIRED_PERMISSIONS);
    return this.required;
  }
}

function createContext(permissions: string[] = []) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ currentUser: { permissions } }),
    }),
  } as any;
}

const noRequirementGuard = new PermissionsGuard(new FakeReflector(undefined) as any);
equal(noRequirementGuard.canActivate(createContext()), true);

const allowedGuard = new PermissionsGuard(new FakeReflector(['students.read', 'students.write']) as any);
equal(allowedGuard.canActivate(createContext(['students.read', 'students.write'])), true);

const rejectedGuard = new PermissionsGuard(new FakeReflector(['students.write']) as any);
throws(() => rejectedGuard.canActivate(createContext(['students.read'])), ForbiddenException);
