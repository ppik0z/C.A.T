import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import type { RequestWithUser as AuthenticatedRequest } from '../common';
import { Throttle } from '@nestjs/throttler';
import { AuthRecoveryService } from './auth-recovery.service';

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
    private readonly recovery: AuthRecoveryService,
  ) {}

  @Post('register') // http://localhost:3000/auth/register
  @Throttle({ short: { ttl: 15 * 60 * 1000, limit: 5 } })
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.cookies.assertTrustedOrigin(req);
    return this.respondWithSession(
      await this.authService.register(registerDto, req.headers['user-agent']),
      req,
      res,
    );
  }

  @Post('login')
  @Throttle({ short: { ttl: 60 * 1000, limit: 5 } })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.cookies.assertTrustedOrigin(req);
    return this.respondWithSession(
      await this.authService.login(loginDto, req.headers['user-agent']),
      req,
      res,
    );
  }

  @Post('refresh')
  @Throttle({ short: { ttl: 60 * 1000, limit: 30 } })
  async refresh(
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.cookies.assertTrustedOrigin(req);
    return this.respondWithSession(
      await this.authService.refreshTokens(this.cookies.getRefreshToken(req)),
      req,
      res,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('email/verification/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ short: { ttl: 15 * 60 * 1000, limit: 3 } })
  async requestEmailVerification(@Request() req: AuthenticatedRequest) {
    await this.recovery.requestEmailVerification(req.user.userId);
    return {
      message: 'Nếu email chưa được xác minh, chúng tôi đã gửi hướng dẫn.',
    };
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 15 * 60 * 1000, limit: 10 } })
  async verifyEmail(
    @Body() body: VerifyEmailDto,
    @Request() req: ExpressRequest,
  ) {
    this.cookies.assertTrustedOrigin(req);
    await this.recovery.verifyEmail(body.token);
    return { message: 'Email đã được xác minh thành công.' };
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ short: { ttl: 15 * 60 * 1000, limit: 5 } })
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
    @Request() req: ExpressRequest,
  ) {
    this.cookies.assertTrustedOrigin(req);
    await this.recovery.requestPasswordReset(body.email);
    return {
      message:
        'Nếu email tồn tại và đã được xác minh, chúng tôi đã gửi hướng dẫn.',
    };
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 15 * 60 * 1000, limit: 10 } })
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.cookies.assertTrustedOrigin(req);
    await this.recovery.resetPassword(body.token, body.newPassword);
    this.cookies.clearRefreshToken(res);
    res.setHeader('Cache-Control', 'no-store');
    return { message: 'Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.' };
  }

  @Post('logout')
  async logout(
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.cookies.assertTrustedOrigin(req);
    this.cookies.clearRefreshToken(res);
    await this.authService.logout(this.cookies.getRefreshToken(req));
    return { message: 'Đăng xuất thành công.' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout-all')
  async logoutAll(
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
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

  private respondWithSession(
    result: Awaited<ReturnType<AuthService['login']>>,
    request: ExpressRequest,
    response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    this.cookies.setRefreshToken(request, response, result.refreshToken);
    return {
      accessToken: result.accessToken,
      expiresInSeconds: result.expiresInSeconds,
    };
  }
}
