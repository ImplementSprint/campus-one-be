import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseHealthService } from './database-health.service';
import { AuthModule as PlatformAuthModule } from '../../../libs/auth/src/platform-auth/auth.module';
import { TenantsModule } from '../../../libs/tenants/src/tenants.module';
import { InstitutionDataModule } from '../../../libs/institution-data/src/institution-data.module';
import { EnrollmentModule } from '../../../libs/academics/src/enrollment/enrollment.module';
import { ProfileModule } from '../../../libs/academics/src/profile/profile.module';
import { DashboardModule } from '../../../libs/academics/src/dashboard/dashboard.module';
import { CoursesModule } from '../../../libs/academics/src/courses/courses.module';
import { GradesModule } from '../../../libs/academics/src/grades/grades.module';
import { SubjectsModule } from '../../../libs/academics/src/subjects/subjects.module';
import { StudentModule } from '../../../libs/academics/src/student/student.module';
import { ApplicationModule } from '../../../libs/admissions/src/application/application.module';
import { AlumniModule } from '../../../libs/alumni/src/alumni/alumni.module';

@Module({
  imports: [
    TenantsModule,
    PlatformAuthModule,
    InstitutionDataModule,
    EnrollmentModule,
    ProfileModule,
    DashboardModule,
    CoursesModule,
    GradesModule,
    SubjectsModule,
    StudentModule,
    ApplicationModule,
    AlumniModule,
  ],
  controllers: [AppController],
  providers: [DatabaseHealthService],
})
export class AppModule {}
