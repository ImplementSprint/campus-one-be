import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateStudentStatusDto {
  @IsEnum(['active', 'inactive'])
  enrollment_status: 'active' | 'inactive';
}

export class UpdateStudentInfoDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  student_number?: string;
}
