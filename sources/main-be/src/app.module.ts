import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { InstitutionModule } from './institution/institution.module';

@Module({
  imports: [AuthModule, InstitutionModule],
  controllers: [AppController],
})
export class AppModule {}
