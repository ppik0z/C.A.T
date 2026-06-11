import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
const EMAIL_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_REQUEST_WINDOW_LIMIT = 3;
const EMAIL_REQUEST_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMAIL_REQUEST_DAILY_LIMIT = 5;
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
    const rateLimit = await this.getEmailIssueRateLimit(
      userId,
      AUTH_ACTION_PURPOSE.VERIFY_EMAIL,
    );
    if (rateLimit) {
      this.throwEmailRateLimit(
        userId,
        AUTH_ACTION_PURPOSE.VERIFY_EMAIL,
        rateLimit,
      );
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
    try {
      await this.emailSender.send(
        this.toEmail(user.email, template, `verify-${action.id}`),
      );
    } catch (error) {
      await this.actionTokens.discard(action.id).catch(() => undefined);
      this.logger.error(
        `Could not send verification email for user ${userId}: ${this.getErrorName(error)}`,
      );
      throw new ServiceUnavailableException(
        'Chưa thể gửi email xác minh. Vui lòng thử lại sau.',
      );
    }
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
      const rateLimit = await this.getEmailIssueRateLimit(
        user.id,
        AUTH_ACTION_PURPOSE.RESET_PASSWORD,
      );
      if (rateLimit) {
        this.logEmailRateLimit(
          user.id,
          AUTH_ACTION_PURPOSE.RESET_PASSWORD,
          rateLimit.retryAfterSeconds,
        );
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
        .catch(async (error: unknown) => {
          await this.actionTokens.discard(action.id).catch(() => undefined);
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

  private async getEmailIssueRateLimit(
    userId: number,
    purpose: (typeof AUTH_ACTION_PURPOSE)[keyof typeof AUTH_ACTION_PURPOSE],
  ) {
    if (
      await this.actionTokens.wasIssuedRecently(
        userId,
        purpose,
        EMAIL_REQUEST_COOLDOWN_MS,
      )
    ) {
      return {
        retryAfterSeconds: Math.ceil(EMAIL_REQUEST_COOLDOWN_MS / 1000),
        message: 'Vui lòng chờ 60 giây trước khi gửi lại email.',
      };
    }

    const [windowLimitReached, dailyLimitReached] = await Promise.all([
      this.actionTokens.hasReachedIssueLimit(
        userId,
        purpose,
        EMAIL_REQUEST_WINDOW_MS,
        EMAIL_REQUEST_WINDOW_LIMIT,
      ),
      this.actionTokens.hasReachedIssueLimit(
        userId,
        purpose,
        EMAIL_REQUEST_DAILY_WINDOW_MS,
        EMAIL_REQUEST_DAILY_LIMIT,
      ),
    ]);

    if (dailyLimitReached) {
      return {
        retryAfterSeconds: Math.ceil(EMAIL_REQUEST_DAILY_WINDOW_MS / 1000),
        message:
          'Bạn đã đạt giới hạn 5 email trong 24 giờ. Vui lòng thử lại sau.',
      };
    }
    if (windowLimitReached) {
      return {
        retryAfterSeconds: Math.ceil(EMAIL_REQUEST_WINDOW_MS / 1000),
        message:
          'Bạn đã đạt giới hạn 3 email trong 15 phút. Vui lòng thử lại sau.',
      };
    }
    return null;
  }

  private throwEmailRateLimit(
    userId: number,
    purpose: string,
    rateLimit: { retryAfterSeconds: number; message: string },
  ): never {
    this.logEmailRateLimit(userId, purpose, rateLimit.retryAfterSeconds);
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'AUTH_EMAIL_RATE_LIMITED',
        message: rateLimit.message,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private logEmailRateLimit(
    userId: number,
    purpose: string,
    retryAfterSeconds: number,
  ) {
    this.logger.warn(
      `Email rate limit exceeded user=${userId} purpose=${purpose} retryAfter=${retryAfterSeconds}s`,
    );
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
