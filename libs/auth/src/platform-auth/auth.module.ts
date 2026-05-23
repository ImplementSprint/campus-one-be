import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AUTH_REPOSITORY, AuthService, PostgresAuthRepository } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: AUTH_REPOSITORY,
      useClass: PostgresAuthRepository,
    },
  ],
})
export class AuthModule {}
