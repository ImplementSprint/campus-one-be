import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenantRegistryPrismaClient } from '@campus-one/database/prisma/tenant-registry-prisma.client';
import { InstitutionModule } from './institution-profile/institution.module';
import { PublicSchoolController } from './public-school.controller';
import { PublicSchoolService } from './public-school.service';
import { TenantResolutionMiddleware } from './tenant-resolution.middleware';
import { TenantResolutionService } from './tenant-resolution.service';
import { TenantRegistryRepository } from './tenant-registry.repository';
import { TenantCurrentController } from './tenant-current.controller';
import { PlatformSchoolOnboardingController } from './platform-school-onboarding.controller';
import {
  PLATFORM_SCHOOL_REGISTRATION_REPOSITORY,
  PlatformSchoolOnboardingService,
  PostgresPlatformSchoolRegistrationRepository,
} from './platform-school-onboarding.service';

@Module({
  imports: [InstitutionModule],
  controllers: [PublicSchoolController, TenantCurrentController, PlatformSchoolOnboardingController],
  providers: [
    TenantRegistryPrismaClient,
    TenantRegistryRepository,
    TenantResolutionService,
    PublicSchoolService,
    PlatformSchoolOnboardingService,
    {
      provide: PLATFORM_SCHOOL_REGISTRATION_REPOSITORY,
      useClass: PostgresPlatformSchoolRegistrationRepository,
    },
  ],
  exports: [InstitutionModule, TenantRegistryRepository, TenantResolutionService],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantResolutionMiddleware).forRoutes('*');
  }
}
