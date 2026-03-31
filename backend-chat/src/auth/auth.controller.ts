import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/create-auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    username: string;
  };
}

@Controller('auth') // http://localhost:3000/auth
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register') // http://localhost:3000/auth/register
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req: RequestWithUser) {
    return {
      message: 'Guard OK',
      user: req.user,
    };
  }
}