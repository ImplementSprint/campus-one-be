import { Module } from '@nestjs/common';
import { AlumniController } from './alumni.controller';
import { AlumniService } from './alumni.service';
import { GraduationListener } from './kafka/graduation.listener';

@Module({
  imports: [],
  controllers: [AlumniController],
  providers: [AlumniService, GraduationListener],
})
export class AlumniModule {}
