import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { users } from '../database/schema';
import {
  buildEmailVerificationEmail,
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
} from '../email/auth-email.templates';
import {
  EMAIL_SENDER,
  type EmailSender,
  type TransactionalEmail,
} from '../email/email-sender';
import { PushSubscriptionsService } from '../push-notifications/push-subscriptions.service';
import { AuthActionTokenService } from './auth-action-token.service';
import {
  AUTH_ACTION_PURPOSE,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from './auth-action-token.types';
import { AuthSessionService } from './auth-session.service';
import { normalizeEmail } from './email-address';
import { assertPasswordFitsBcrypt } from './password-policy';
import { PasswordHasherService } from './password-hasher.service';

const EMAIL_REQUEST_COOLDOWN_MS = 60 * 1000;
const MIN_FORGOT_RESPONSE_MS = 300;

@Injectable()
export class AuthRecoveryService {
  private readonly logger = new Logger(AuthRecoveryService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly actionTokens: AuthActionTokenService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly sessions: AuthSessionService,
    private readonly pushSubscriptions: PushSubscriptionsService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
  ) {}

  async requestEmailVerification(userId: number) {
    const [user] = await this.drizzle.db
      .select({
        email: users.email,
        isEmailVerified: users.isEmailVerified,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.email || user.isEmailVerified) return;
    if (
      await this.actionTokens.wasIssuedRecently(
        userId,
        AUTH_ACTION_PURPOSE.VERIFY_EMAIL,
        EMAIL_REQUEST_COOLDOWN_MS,
      )
    ) {
      return;
    }

    const action = await this.actionTokens.issue(
      userId,
      user.email,
      AUTH_ACTION_PURPOSE.VERIFY_EMAIL,
      EMAIL_VERIFICATION_TTL_MS,
    );
    const template = buildEmailVerificationEmail(
      this.createPublicUrl('/verify-email', action.rawToken),
    );
    await this.emailSender.send(
      this.toEmail(user.email, template, `verify-${action.id}`),
    );
  }

  async verifyEmail(rawToken: string) {
    await this.actionTokens.consumeEmailVerification(rawToken);
  }

  async requestPasswordReset(emailInput: string) {
    const startedAt = Date.now();
    try {
      const email = normalizeEmail(emailInput);
      const [user] = await this.drizzle.db
        .select({
          id: users.id,
          email: users.email,
          isEmailVerified: users.isEmailVerified,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user?.email || !user.isEmailVerified) return;
      if (
        await this.actionTokens.wasIssuedRecently(
          user.id,
          AUTH_ACTION_PURPOSE.RESET_PASSWORD,
          EMAIL_REQUEST_COOLDOWN_MS,
        )
      ) {
        return;
      }

      const action = await this.actionTokens.issue(
        user.id,
        user.email,
        AUTH_ACTION_PURPOSE.RESET_PASSWORD,
        PASSWORD_RESET_TTL_MS,
      );
      const template = buildPasswordResetEmail(
        this.createPublicUrl('/reset-password', action.rawToken),
      );
      void this.emailSender
        .send(this.toEmail(user.email, template, `reset-${action.id}`))
        .catch((error: unknown) => {
          this.logger.error(
            `Could not send password reset email: ${this.getErrorName(error)}`,
          );
        });
    } finally {
      const remainingDelay = MIN_FORGOT_RESPONSE_MS - (Date.now() - startedAt);
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }
    }
  }

  async resetPassword(rawToken: string, newPassword: string) {
    assertPasswordFitsBcrypt(newPassword);
    const passwordHash = await this.passwordHasher.hash(newPassword);
    const result = await this.actionTokens.consumePasswordReset(
      rawToken,
      passwordHash,
    );

    await Promise.all([
      this.sessions.revokeAllForUser(result.userId),
      this.pushSubscriptions.revokeAllForUser(result.userId),
    ]);

    const template = buildPasswordChangedEmail();
    void this.emailSender
      .send(
        this.toEmail(
          result.email,
          template,
          `password-changed-${result.userId}-${Date.now()}`,
        ),
      )
      .catch((error: unknown) => {
        this.logger.error(
          `Could not send password changed email: ${this.getErrorName(error)}`,
        );
      });
  }

  private createPublicUrl(path: string, rawToken: string) {
    const configuredUrl =
      process.env.PUBLIC_APP_URL?.trim() || process.env.FRONTEND_URL?.trim();
    if (!configuredUrl && process.env.NODE_ENV === 'production') {
      throw new Error('PUBLIC_APP_URL is required in production.');
    }
    const baseUrl = configuredUrl || 'http://localhost:5173';
    const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    url.searchParams.set('token', rawToken);
    return url.toString();
  }

  private toEmail(
    to: string,
    template: { subject: string; html: string; text: string },
    idempotencyKey: string,
  ): TransactionalEmail {
    return { to, ...template, idempotencyKey };
  }

  private getErrorName(error: unknown) {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
