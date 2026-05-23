import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterSchoolDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Length(2, 120)
  representative!: string;

  @IsEmail()
  @Length(5, 160)
  email!: string;

  @IsString()
  @Length(7, 40)
  @Matches(/^[+0-9 ()-]+$/)
  contactNumber!: string;

  @IsString()
  @Length(2, 80)
  schoolType!: string;

  @IsString()
  @Length(3, 63)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
  targetSubdomain!: string;
}
