import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenantResolutionMiddleware } from './tenant-resolution.middleware';
import { InstitutionModule } from './institution-profile/institution.module';

@Module({
  imports: [InstitutionModule],
  exports: [InstitutionModule],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantResolutionMiddleware).forRoutes('*');
  }
}
