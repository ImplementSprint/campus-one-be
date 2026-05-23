import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentityAccessRepository } from './identity-access.repository';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { IdentityAccessPrismaClient } from '@campus-one/database/prisma/identity-access-prisma.client';

@Module({
  controllers: [AuthController],
  providers: [
    IdentityAccessPrismaClient,
    IdentityAccessRepository,
    AuthService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AuthModule {}
