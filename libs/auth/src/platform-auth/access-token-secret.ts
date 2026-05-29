import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';

export function getAccessTokenSecretForSigning(): string {
  const secret = process.env.JWT_ACCESS_TOKEN_SECRET || process.env.CAMPUS_ONE_AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new InternalServerErrorException('JWT_ACCESS_TOKEN_SECRET must be configured.');
  }
  return secret;
}

export function getAccessTokenSecretForVerification(): string {
  const secret = process.env.JWT_ACCESS_TOKEN_SECRET || process.env.CAMPUS_ONE_AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new UnauthorizedException('Route token verification is not configured.');
  }
  return secret;
}
