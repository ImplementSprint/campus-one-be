import { IsOptional, IsString, Length } from 'class-validator';

export class RejectSchoolDto {
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class SchoolReviewNoteDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}
