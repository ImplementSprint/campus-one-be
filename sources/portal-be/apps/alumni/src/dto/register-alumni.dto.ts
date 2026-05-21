import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class RegisterAlumniDto {
  @IsUUID()
  actor_uuid: string;

  @IsString()
  tenant_id: string;

  @IsString()
  first_name: string;

  @IsString()
  @IsOptional()
  middle_name?: string;

  @IsString()
  last_name: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  academic_unit: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  graduation_year: number;

  @IsString()
  program: string;

  /**
   * true = no pre-existing student record (legacy/manual verification path)
   * false = standard internal path (student ID lookup)
   */
  @IsBoolean()
  @IsOptional()
  is_legacy_registration?: boolean;

  @IsString()
  @IsOptional()
  student_id?: string;

  @IsString()
  @IsOptional()
  proof_reference?: string;

  @IsString()
  @IsOptional()
  document_url?: string;
}
