import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAccessTokenSecretForVerification } from './access-token-secret';

export type AuthorizedRouteUser = {
  id: string;
  email?: string | null;
  role: string;
  activeInstitutionId?: string | null;
  schoolSlug?: string | null;
};

export type RouteAuthorizationInput = {
  authorization?: string | null;
  role?: string | null;
  userId?: string | null;
  institutionId?: string | null;
  schoolSlug?: string | null;
  allowedRoles: string[];
};

type VerifiedRouteToken = {
  sub: string;
  email?: string | null;
  role: string;
  activeInstitutionId?: string | null;
};

export function authorizeRoute(input: RouteAuthorizationInput): AuthorizedRouteUser {
  const authorization = input.authorization?.trim();
  const role = input.role?.trim();
  const userId = input.userId?.trim();

  if (!authorization?.toLowerCase().startsWith('bearer ') || !userId || !role) {
    throw new UnauthorizedException('Bearer token, user id, and role are required.');
  }

  const token = verifyRouteAccessToken(authorization.slice('bearer '.length).trim());
  if (token.sub !== userId || token.role !== role) {
    throw new UnauthorizedException('Bearer token does not match route identity headers.');
  }

  if (!input.allowedRoles.includes(token.role)) {
    throw new ForbiddenException('Insufficient role for this route.');
  }

  const requestedInstitutionId = input.institutionId?.trim();
  if (token.activeInstitutionId && requestedInstitutionId && token.activeInstitutionId !== requestedInstitutionId) {
    throw new ForbiddenException('Token tenant does not match requested tenant.');
  }

  return {
    id: token.sub,
    email: token.email ?? null,
    role: token.role,
    activeInstitutionId: token.activeInstitutionId ?? null,
    schoolSlug: input.schoolSlug ?? null,
  };
}

function verifyRouteAccessToken(token: string): VerifiedRouteToken {
  const secret = getAccessTokenSecretForVerification();

  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) {
    throw new UnauthorizedException('Invalid access token.');
  }

  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  const actualSignature = Buffer.from(signature);
  const expectedSignature = Buffer.from(expected);
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new UnauthorizedException('Invalid access token.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new UnauthorizedException('Invalid access token.');
  }

  if (!parsed.sub || !parsed.role) {
    throw new UnauthorizedException('Invalid access token.');
  }

  return {
    sub: String(parsed.sub),
    email: parsed.email ? String(parsed.email) : null,
    role: String(parsed.role),
    activeInstitutionId: parsed.activeInstitutionId ?? null,
  };
}
