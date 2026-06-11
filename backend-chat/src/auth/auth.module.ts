import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthCookieService } from './auth-cookie.service';
import { AuthSessionService } from './auth-session.service';
import { PasswordHasherService } from './password-hasher.service';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { getJwtModuleOptions } from './auth.constants';
import { AuthIdentityService } from './auth-identity.service';
import { EMAIL_SENDER } from '../email/email-sender';
import { ResendEmailSender } from '../email/resend-email-sender.service';
import { AuthActionTokenService } from './auth-action-token.service';
import { AuthRecoveryService } from './auth-recovery.service';

@Module({
  imports: [
    PassportModule,
    PushNotificationsModule,
    JwtModule.register(getJwtModuleOptions()),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AuthCookieService,
    AuthSessionService,
    AuthIdentityService,
    PasswordHasherService,
    AuthActionTokenService,
    AuthRecoveryService,
    ResendEmailSender,
    {
      provide: EMAIL_SENDER,
      useExisting: ResendEmailSender,
    },
  ],
  exports: [
    JwtModule,
    AuthService,
    AuthSessionService,
    AuthIdentityService,
    PasswordHasherService,
  ],
})
export class AuthModule {}
