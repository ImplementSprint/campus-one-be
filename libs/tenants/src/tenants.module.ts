import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { InstitutionModule } from './institution-profile/institution.module';
import { PublicSchoolController } from './public-school.controller';
import { PublicSchoolService } from './public-school.service';
import { TenantResolutionMiddleware } from './tenant-resolution.middleware';
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
    PublicSchoolService,
    PlatformSchoolOnboardingService,
    {
      provide: PLATFORM_SCHOOL_REGISTRATION_REPOSITORY,
      useClass: PostgresPlatformSchoolRegistrationRepository,
    },
  ],
  exports: [InstitutionModule],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantResolutionMiddleware).forRoutes('*');
  }
}
