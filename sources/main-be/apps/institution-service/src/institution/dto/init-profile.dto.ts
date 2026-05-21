import { IsString, IsEmail } from 'class-validator';

export class InitProfileDto {
  @IsString()
  userId: string;

  @IsEmail()
  email: string;
}
