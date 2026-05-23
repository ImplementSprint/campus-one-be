import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { RequirePermissions } from '../../../auth/src/platform-auth/permissions.decorator';
import { Public } from '../../../auth/src/platform-auth/public.decorator';
import { StudentService } from './student.service';
import { UpdateStudentInfoDto, UpdateStudentStatusDto } from './dto/update-student.dto';

@Controller('v1/student')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  /**
   * GET /api/v1/student/health
   * Health check endpoint â€” required by architecture plan.
   */
  @Get('health')
  @Public()
  health() {
    return this.studentService.getHealth();
  }

  /**
   * GET /api/v1/student/stats
   * Returns total, active, inactive, and pending student counts.
   * Used by the Student Admin Dashboard overview cards.
   */
  @Get('stats')
  @RequirePermissions('students.read')
  async getStats() {
    return this.studentService.getStats();
  }

  /**
   * GET /api/v1/student
   * Returns all students joined with their applicant profile.
   * Used by the Student Directory view.
   */
  @Get()
  @RequirePermissions('students.read')
  async findAll() {
    return this.studentService.findAll();
  }

  /**
   * GET /api/v1/student/:id
   * Returns a single student with full profile details.
   * Used by the Student Detail view.
   */
  @Get(':id')
  @RequirePermissions('students.read')
  async findOne(@Param('id') id: string) {
    this.assertStudentId(id);

    return this.studentService.findOne(id);
  }

  @Get(':id/enrolled-courses')
  async getEnrolledCourses(@Param('id') id: string) {
    this.assertStudentId(id);

    return this.studentService.getEnrolledCourses(id);
  }

  @Get(':id/class-schedule')
  async getClassSchedule(@Param('id') id: string) {
    this.assertStudentId(id);

    return this.studentService.getClassSchedule(id);
  }

  @Get(':id/curriculum-progress')
  async getCurriculumProgress(@Param('id') id: string) {
    this.assertStudentId(id);

    return this.studentService.getCurriculumProgress(id);
  }

  @Get(':id/holds-deficiencies')
  async getHoldsAndDeficiencies(@Param('id') id: string) {
    this.assertStudentId(id);

    return this.studentService.getHoldsAndDeficiencies(id);
  }

  @Get(':id/announcements')
  async getAnnouncements(@Param('id') id: string) {
    this.assertStudentId(id);

    return this.studentService.getAnnouncements(id);
  }

  /**
   * PATCH /api/v1/student/:id/status
   * Activates or deactivates a student account.
   * Used by the Activate / Deactivate buttons in Student Detail.
   */
  @Patch(':id/status')
  @RequirePermissions('students.write')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStudentStatusDto,
  ) {
    this.assertStudentId(id);
    this.assertStatusPayload(dto);

    return this.studentService.updateStatus(id, dto);
  }

  /**
   * PATCH /api/v1/student/:id
   * Updates basic student account info (email, student_number).
   */
  @Patch(':id')
  @RequirePermissions('students.write')
  @HttpCode(HttpStatus.OK)
  async updateInfo(
    @Param('id') id: string,
    @Body() dto: UpdateStudentInfoDto,
  ) {
    this.assertStudentId(id);
    this.assertInfoPayload(dto);

    return this.studentService.updateInfo(id, dto);
  }

  private assertStudentId(id: string) {
    if (!id?.trim()) {
      throw new BadRequestException('student id is required');
    }
  }

  private assertStatusPayload(dto: UpdateStudentStatusDto) {
    if (
      dto?.enrollment_status !== 'active' &&
      dto?.enrollment_status !== 'inactive'
    ) {
      throw new BadRequestException('enrollment_status must be active or inactive');
    }
  }

  private assertInfoPayload(dto: UpdateStudentInfoDto) {
    if (!dto || (!dto.email?.trim() && !dto.student_number?.trim())) {
      throw new BadRequestException('At least one of email or student_number is required');
    }
  }
}


