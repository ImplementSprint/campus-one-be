import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { UpdateStudentInfoDto, UpdateStudentStatusDto } from './dto/update-student.dto';

@Controller('v1/student')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  /**
   * GET /api/v1/student/health
   * Health check endpoint — required by architecture plan.
   */
  @Get('health')
  health() {
    return this.studentService.getHealth();
  }

  /**
   * GET /api/v1/student/stats
   * Returns total, active, inactive, and pending student counts.
   * Used by the Student Admin Dashboard overview cards.
   */
  @Get('stats')
  async getStats() {
    return this.studentService.getStats();
  }

  /**
   * GET /api/v1/student
   * Returns all students joined with their applicant profile.
   * Used by the Student Directory view.
   */
  @Get()
  async findAll() {
    return this.studentService.findAll();
  }

  /**
   * GET /api/v1/student/:id
   * Returns a single student with full profile details.
   * Used by the Student Detail view.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.studentService.findOne(id);
  }

  /**
   * PATCH /api/v1/student/:id/status
   * Activates or deactivates a student account.
   * Used by the Activate / Deactivate buttons in Student Detail.
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStudentStatusDto,
  ) {
    return this.studentService.updateStatus(id, dto);
  }

  /**
   * PATCH /api/v1/student/:id
   * Updates basic student account info (email, student_number).
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateInfo(
    @Param('id') id: string,
    @Body() dto: UpdateStudentInfoDto,
  ) {
    return this.studentService.updateInfo(id, dto);
  }
}
