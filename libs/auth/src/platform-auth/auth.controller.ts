import { Controller, Get, Post, Body, Headers, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body() body: SignUpDto) {
    return this.authService.signUp(body);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('signin')
  @Public()
  @HttpCode(HttpStatus.OK)
  signIn(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('signout')
  @HttpCode(HttpStatus.OK)
  signOut() {
    return this.authService.signOut();
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  me(@Headers('authorization') authorization?: string, @Req() req?: any) {
    return this.authService.getCurrentUser(authorization, req?.tenantContext);
  }
}
