import { equal, rejects } from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_ROUTE } from './public.decorator';

class FakeReflector {
  constructor(private readonly isPublic: boolean) {}

  getAllAndOverride(key: string) {
    equal(key, IS_PUBLIC_ROUTE);
    return this.isPublic;
  }
}

function createContext(headers: Record<string, string | undefined> = {}, tenantContext?: any) {
  const request = { headers, tenantContext };
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

async function run() {
  const publicGuard = new JwtAuthGuard(new FakeReflector(true) as any, {
    getCurrentUser: async () => {
      throw new Error('Public routes should not resolve current user');
    },
  } as any);

  equal(await publicGuard.canActivate(createContext()), true);

  const tenantContext = { institutionId: 'institution-123', schoolSlug: 'demo', isPlatformRoute: false, source: 'subdomain' };
  const protectedContext = createContext({ authorization: 'Bearer valid-token' }, tenantContext);
  const protectedGuard = new JwtAuthGuard(new FakeReflector(false) as any, {
    getCurrentUser: async (authorization: string, receivedTenantContext: any) => {
      equal(authorization, 'Bearer valid-token');
      equal(receivedTenantContext, tenantContext);
      return { user: { id: 'user-123', email: 'student@example.edu', role: 'student', permissions: ['grades.self.read'] } };
    },
  } as any);

  equal(await protectedGuard.canActivate(protectedContext), true);
  equal(protectedContext.switchToHttp().getRequest().currentUser.role, 'student');
  equal(protectedContext.switchToHttp().getRequest().currentUser.permissions[0], 'grades.self.read');

  const rejectingGuard = new JwtAuthGuard(new FakeReflector(false) as any, {
    getCurrentUser: async () => {
      throw new UnauthorizedException('Missing bearer token.');
    },
  } as any);

  await rejects(() => rejectingGuard.canActivate(createContext()), UnauthorizedException);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
