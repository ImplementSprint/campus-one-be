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
import { ProfessorModule } from '../../../libs/academics/src/professor/professor.module';
import { SubjectsModule } from '../../../libs/academics/src/subjects/subjects.module';
import { StudentModule } from '../../../libs/academics/src/student/student.module';
import { ApplicationModule } from '../../../libs/admissions/src/application/application.module';
import { AlumniModule } from '../../../libs/alumni/src/alumni/alumni.module';
import { BillingModule } from '../../../libs/billing/src/billing.module';
import { NotificationsModule } from '../../../libs/notifications/src/notifications.module';
import { AuditModule } from '../../../libs/audit/src/audit.module';
import { SchoolAdminModule } from '../../../libs/school-admin/src/school-admin.module';

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
    ProfessorModule,
    SubjectsModule,
    StudentModule,
    ApplicationModule,
    AlumniModule,
    BillingModule,
    NotificationsModule,
    AuditModule,
    SchoolAdminModule,
  ],
  controllers: [AppController],
  providers: [DatabaseHealthService],
})
export class AppModule {}
