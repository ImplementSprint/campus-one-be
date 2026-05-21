import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

// Core modules (main gateway)
import { EnrollmentModule } from './apps/enrollment/enrollment.module';
import { AuthModule } from './apps/auth/auth.module';
import { ProfileModule } from './apps/profile/profile.module';
import { DashboardModule } from './apps/dashboard/dashboard.module';
import { CoursesModule } from './apps/courses/courses.module';
import { GradesModule } from './apps/grades/grades.module';
import { SubjectsModule } from './apps/subjects/subjects.module';

// Microservice modules (apps/)
import { AlumniModule } from '../apps/alumni/src/alumni.module';
import { ApplicationModule } from '../apps/application/src/application.module';

@Module({
  imports: [
    // Gateway modules
    EnrollmentModule,
    AuthModule,
    ProfileModule,
    DashboardModule,
    CoursesModule,
    GradesModule,
    SubjectsModule,
    // Service modules
    AlumniModule,
    ApplicationModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
