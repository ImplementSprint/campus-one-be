import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password: string;
}
