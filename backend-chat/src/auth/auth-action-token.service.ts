import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { and, eq, gt, gte, isNull } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import {
  authActionTokens,
  authSessions,
  pushSubscriptions,
  users,
} from '../database/schema';
import {
  AUTH_ACTION_PURPOSE,
  type AuthActionPurpose,
} from './auth-action-token.types';
import { normalizeEmail } from './email-address';

const TOKEN_BYTES = 32;
const TOKEN_LENGTH = 43;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const INVALID_TOKEN_MESSAGE = 'Liên kết không hợp lệ hoặc đã hết hạn.';

@Injectable()
export class AuthActionTokenService {
  constructor(private readonly drizzle: DrizzleService) {}

  async issue(
    userId: number,
    targetEmail: string,
    purpose: AuthActionPurpose,
    ttlMs: number,
  ) {
    const id = randomUUID();
    const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
    const now = new Date();

    await this.drizzle.db.transaction(async (tx) => {
      await tx
        .update(authActionTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(authActionTokens.userId, userId),
            eq(authActionTokens.purpose, purpose),
            isNull(authActionTokens.consumedAt),
          ),
        );

      await tx.insert(authActionTokens).values({
        id,
        userId,
        purpose,
        tokenHash: this.hash(rawToken),
        targetEmail: normalizeEmail(targetEmail),
        expiresAt: new Date(now.getTime() + ttlMs),
      });
    });

    return { id, rawToken };
  }

  async wasIssuedRecently(
    userId: number,
    purpose: AuthActionPurpose,
    windowMs: number,
  ) {
    const [recentToken] = await this.drizzle.db
      .select({ id: authActionTokens.id })
      .from(authActionTokens)
      .where(
        and(
          eq(authActionTokens.userId, userId),
          eq(authActionTokens.purpose, purpose),
          isNull(authActionTokens.consumedAt),
          gt(authActionTokens.createdAt, new Date(Date.now() - windowMs)),
        ),
      )
      .limit(1);
    return Boolean(recentToken);
  }

  async hasReachedIssueLimit(
    userId: number,
    purpose: AuthActionPurpose,
    windowMs: number,
    limit: number,
  ) {
    const tokens = await this.drizzle.db
      .select({ id: authActionTokens.id })
      .from(authActionTokens)
      .where(
        and(
          eq(authActionTokens.userId, userId),
          eq(authActionTokens.purpose, purpose),
          gte(authActionTokens.createdAt, new Date(Date.now() - windowMs)),
        ),
      )
      .limit(limit);
    return tokens.length >= limit;
  }

  async discard(id: string) {
    await this.drizzle.db
      .delete(authActionTokens)
      .where(eq(authActionTokens.id, id));
  }

  async consumeEmailVerification(rawToken: string) {
    const tokenHash = this.parseAndHash(rawToken);

    return this.drizzle.db.transaction(async (tx) => {
      const action = await this.findForUpdate(
        tx,
        tokenHash,
        AUTH_ACTION_PURPOSE.VERIFY_EMAIL,
      );
      const [user] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, action.userId))
        .limit(1);

      if (!user?.email || normalizeEmail(user.email) !== action.targetEmail) {
        throw new BadRequestException(INVALID_TOKEN_MESSAGE);
      }

      const consumedAt = new Date();
      await tx
        .update(users)
        .set({ isEmailVerified: true })
        .where(eq(users.id, action.userId));
      await tx
        .update(authActionTokens)
        .set({ consumedAt })
        .where(
          and(
            eq(authActionTokens.id, action.id),
            isNull(authActionTokens.consumedAt),
          ),
        );

      return { userId: action.userId };
    });
  }

  async consumePasswordReset(rawToken: string, passwordHash: string) {
    const tokenHash = this.parseAndHash(rawToken);

    return this.drizzle.db.transaction(async (tx) => {
      const action = await this.findForUpdate(
        tx,
        tokenHash,
        AUTH_ACTION_PURPOSE.RESET_PASSWORD,
      );
      const [user] = await tx
        .select({
          email: users.email,
          isEmailVerified: users.isEmailVerified,
        })
        .from(users)
        .where(eq(users.id, action.userId))
        .limit(1);

      if (
        !user?.email ||
        !user.isEmailVerified ||
        normalizeEmail(user.email) !== action.targetEmail
      ) {
        throw new BadRequestException(INVALID_TOKEN_MESSAGE);
      }

      const consumedAt = new Date();
      await tx
        .update(users)
        .set({ password: passwordHash })
        .where(eq(users.id, action.userId));
      await tx
        .update(authActionTokens)
        .set({ consumedAt })
        .where(
          and(
            eq(authActionTokens.userId, action.userId),
            eq(authActionTokens.purpose, AUTH_ACTION_PURPOSE.RESET_PASSWORD),
            isNull(authActionTokens.consumedAt),
          ),
        );
      await tx
        .update(authSessions)
        .set({ revokedAt: consumedAt })
        .where(
          and(
            eq(authSessions.userId, action.userId),
            isNull(authSessions.revokedAt),
          ),
        );
      await tx
        .update(pushSubscriptions)
        .set({ revokedAt: consumedAt })
        .where(
          and(
            eq(pushSubscriptions.userId, action.userId),
            isNull(pushSubscriptions.revokedAt),
          ),
        );

      return { userId: action.userId, email: user.email };
    });
  }

  private async findForUpdate(
    tx: Parameters<Parameters<typeof this.drizzle.db.transaction>[0]>[0],
    tokenHash: string,
    purpose: AuthActionPurpose,
  ) {
    const [action] = await tx
      .select({
        id: authActionTokens.id,
        userId: authActionTokens.userId,
        targetEmail: authActionTokens.targetEmail,
        expiresAt: authActionTokens.expiresAt,
        consumedAt: authActionTokens.consumedAt,
      })
      .from(authActionTokens)
      .where(
        and(
          eq(authActionTokens.tokenHash, tokenHash),
          eq(authActionTokens.purpose, purpose),
        ),
      )
      .limit(1)
      .for('update');

    if (!action || action.consumedAt || action.expiresAt <= new Date()) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE);
    }
    return action;
  }

  private parseAndHash(rawToken: string) {
    if (rawToken.length !== TOKEN_LENGTH || !TOKEN_PATTERN.test(rawToken)) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE);
    }
    return this.hash(rawToken);
  }

  private hash(rawToken: string) {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
