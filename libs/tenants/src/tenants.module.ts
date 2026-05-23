import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { InstitutionModule } from './institution-profile/institution.module';
import { PlatformSchoolController } from './platform-school.controller';
import { PlatformSchoolReviewService } from './platform-school-review.service';
import { PublicSchoolController } from './public-school.controller';
import { PublicSchoolService } from './public-school.service';
import { SchoolOnboardingService } from './school-onboarding.service';
import { TenantRegistryRepository } from './tenant-registry.repository';
import { TenantResolutionMiddleware } from './tenant-resolution.middleware';
import { TenantResolutionService } from './tenant-resolution.service';
import { TenantRegistryPrismaClient } from '@campus-one/database/prisma/tenant-registry-prisma.client';

@Module({
  imports: [InstitutionModule],
  controllers: [PublicSchoolController, PlatformSchoolController],
  providers: [
    PublicSchoolService,
    PlatformSchoolReviewService,
    SchoolOnboardingService,
    TenantRegistryPrismaClient,
    TenantRegistryRepository,
    TenantResolutionService,
  ],
  exports: [InstitutionModule],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantResolutionMiddleware).forRoutes('*');
  }
}
