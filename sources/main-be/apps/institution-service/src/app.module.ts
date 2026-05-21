import { Module } from '@nestjs/common';
import { InstitutionModule } from './institution/institution.module';

@Module({
  imports: [InstitutionModule],
})
export class AppModule {}
