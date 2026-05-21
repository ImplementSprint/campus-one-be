import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body() body: SignUpDto) {
    return this.authService.signUp(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('signout')
  @HttpCode(HttpStatus.OK)
  signOut() {
    return this.authService.signOut();
  }
}
