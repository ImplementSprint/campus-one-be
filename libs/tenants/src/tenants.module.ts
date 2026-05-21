import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { InstitutionModule } from './institution-profile/institution.module';
import { PublicSchoolController } from './public-school.controller';
import { PublicSchoolService } from './public-school.service';
import { TenantResolutionMiddleware } from './tenant-resolution.middleware';

@Module({
  imports: [InstitutionModule],
  controllers: [PublicSchoolController],
  providers: [PublicSchoolService],
  exports: [InstitutionModule],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantResolutionMiddleware).forRoutes('*');
  }
}
