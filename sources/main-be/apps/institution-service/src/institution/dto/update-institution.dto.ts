import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateInstitutionDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() representative?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() contact_number?: string;
  @IsString() @IsOptional() school_type?: string;
  @IsString() @IsOptional() target_subdomain?: string;
  @IsString() @IsOptional() status?: string;
  @IsInt() @Min(0) @Max(100) @IsOptional() setup_progress?: number;
}
