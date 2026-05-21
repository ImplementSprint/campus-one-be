import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  async signIn(@Body() body: { email: string; password: string }) {
    try {
      return await this.authService.signIn(body.email, body.password);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('signout')
  async signOut() {
    try {
      return await this.authService.signOut();
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
