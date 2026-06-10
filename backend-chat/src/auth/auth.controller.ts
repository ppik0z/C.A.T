import { Controller, Post, Body, UseGuards, Request, Get, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import type { RequestWithUser as AuthenticatedRequest } from '../common';
import { Throttle } from '@nestjs/throttler';

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    username: string;
  };
}

@Controller('auth') // http://localhost:3000/auth
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieService,
  ) { }

  @Post('register') // http://localhost:3000/auth/register
  @Throttle({ short: { ttl: 15 * 60 * 1000, limit: 5 } })
  async register(@Body() registerDto: RegisterDto, @Request() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    this.cookies.assertTrustedOrigin(req);
    return this.respondWithSession(await this.authService.register(registerDto, req.headers['user-agent']), req, res);
  }

  @Post('login')
  @Throttle({ short: { ttl: 60 * 1000, limit: 5 } })
  async login(@Body() loginDto: LoginDto, @Request() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    this.cookies.assertTrustedOrigin(req);
    return this.respondWithSession(await this.authService.login(loginDto, req.headers['user-agent']), req, res);
  }

  @Post('refresh')
  @Throttle({ short: { ttl: 60 * 1000, limit: 30 } })
  async refresh(@Request() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    this.cookies.assertTrustedOrigin(req);
    return this.respondWithSession(await this.authService.refreshTokens(this.cookies.getRefreshToken(req)), req, res);
  }

  @Post('logout')
  async logout(@Request() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    this.cookies.assertTrustedOrigin(req);
    this.cookies.clearRefreshToken(res);
    await this.authService.logout(this.cookies.getRefreshToken(req));
    return { message: 'Đăng xuất thành công.' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout-all')
  async logoutAll(@Request() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    this.cookies.assertTrustedOrigin(req);
    this.cookies.clearRefreshToken(res);
    await this.authService.logoutAll(req.user.userId);
    return { message: 'Đã đăng xuất khỏi tất cả thiết bị.' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req: RequestWithUser) {
    return {
      message: 'Guard OK',
      user: req.user,
    };
  }

  private respondWithSession(result: Awaited<ReturnType<AuthService['login']>>, request: ExpressRequest, response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    this.cookies.setRefreshToken(request, response, result.refreshToken);
    return {
      accessToken: result.accessToken,
      expiresInSeconds: result.expiresInSeconds,
    };
  }
}
