import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/create-auth.dto';

@Controller('auth') // http://localhost:3000/auth
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register') // http://localhost:3000/auth/register
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}