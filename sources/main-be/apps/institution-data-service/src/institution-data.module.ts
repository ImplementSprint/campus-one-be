import { Module } from '@nestjs/common';
import { InstitutionDataController } from './institution-data.controller';
import { InstitutionDataService } from './institution-data.service';

@Module({
  controllers: [InstitutionDataController],
  providers: [InstitutionDataService],
})
export class InstitutionDataModule {}
