import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthCookieService } from './auth-cookie.service';
import { AuthSessionService } from './auth-session.service';
import { PasswordHasherService } from './password-hasher.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: '1d' }, //Token expire 1 ngày
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthCookieService, AuthSessionService, PasswordHasherService],
  exports: [AuthService, AuthSessionService, PasswordHasherService],
})
export class AuthModule { }
