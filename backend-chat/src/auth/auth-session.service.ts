import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../database/drizzle.service';
import { authSessions } from '../database/schema';
import {
  AUTH_SESSION_REVOKED_EVENT,
  AUTH_USER_SESSIONS_REVOKED_EVENT,
  type AuthSessionRevokedEvent,
  type AuthUserSessionsRevokedEvent,
} from './auth-session.events';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_SECRET_BYTES = 32;
const REFRESH_SECRET_LENGTH = 43;
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFRESH_SECRET_PATTERN = /^[A-Za-z0-9_-]+$/;

type RotationOutcome =
  | {
      status: 'rotated';
      sessionId: string;
      userId: number;
      refreshToken: string;
    }
  | {
      status: 'invalid';
      revokedSessionId?: string;
    };

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: number, userAgent?: string) {
    const id = randomUUID();
    const secret = this.createSecret();
    await this.drizzle.db.insert(authSessions).values({
      id,
      userId,
      refreshTokenHash: this.hash(secret),
      userAgent: userAgent?.slice(0, 255) || null,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
    return { id, refreshToken: this.serialize(id, secret) };
  }

  async rotate(serializedToken: string) {
    const { id, secret } = this.parse(serializedToken);
    const outcome = await this.drizzle.db.transaction<RotationOutcome>(async (tx) => {
      const [session] = await tx
        .select({
          id: authSessions.id,
          userId: authSessions.userId,
          refreshTokenHash: authSessions.refreshTokenHash,
          previousRefreshTokenHash: authSessions.previousRefreshTokenHash,
          expiresAt: authSessions.expiresAt,
          revokedAt: authSessions.revokedAt,
        })
        .from(authSessions)
        .where(eq(authSessions.id, id))
        .limit(1)
        .for('update');

      const now = new Date();
      if (!session || session.revokedAt || session.expiresAt <= now) {
        return { status: 'invalid' };
      }

      if (!this.matches(secret, session.refreshTokenHash)) {
        if (
          !session.previousRefreshTokenHash
          || !this.matches(secret, session.previousRefreshTokenHash)
        ) {
          return { status: 'invalid' };
        }

        await tx
          .update(authSessions)
          .set({ revokedAt: now })
          .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt)));
        return { status: 'invalid', revokedSessionId: id };
      }

      const nextSecret = this.createSecret();
      await tx
        .update(authSessions)
        .set({
          previousRefreshTokenHash: session.refreshTokenHash,
          refreshTokenHash: this.hash(nextSecret),
          lastUsedAt: now,
          rotatedAt: now,
          expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
        })
        .where(eq(authSessions.id, id));

      return {
        status: 'rotated',
        sessionId: session.id,
        userId: session.userId,
        refreshToken: this.serialize(id, nextSecret),
      };
    });

    if (outcome.status === 'invalid') {
      if (outcome.revokedSessionId) {
        this.emitSessionRevoked(outcome.revokedSessionId);
      }
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }

    return outcome;
  }

  async revokeSerialized(serializedToken: string | null) {
    const parsed = this.tryParse(serializedToken);
    if (!parsed) return null;

    const revokedSessionId = await this.drizzle.db.transaction<string | null>(async (tx) => {
      const [session] = await tx
        .select({
          id: authSessions.id,
          refreshTokenHash: authSessions.refreshTokenHash,
          revokedAt: authSessions.revokedAt,
        })
        .from(authSessions)
        .where(eq(authSessions.id, parsed.id))
        .limit(1)
        .for('update');

      if (!session || session.revokedAt || !this.matches(parsed.secret, session.refreshTokenHash)) {
        return null;
      }

      await tx
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessions.id, session.id), isNull(authSessions.revokedAt)));
      return session.id;
    });

    if (revokedSessionId) {
      this.emitSessionRevoked(revokedSessionId);
    }
    return revokedSessionId;
  }

  async revokeAllForUser(userId: number) {
    await this.drizzle.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
    this.events.emit(AUTH_USER_SESSIONS_REVOKED_EVENT, {
      userId,
    } satisfies AuthUserSessionsRevokedEvent);
  }

  private parse(serializedToken: string) {
    const parsed = this.tryParse(serializedToken);
    if (!parsed) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ.');
    return parsed;
  }

  private tryParse(serializedToken: string | null) {
    if (!serializedToken) return null;
    const parts = serializedToken.split('.');
    if (parts.length !== 2) return null;

    const [id, secret] = parts;
    if (
      !SESSION_ID_PATTERN.test(id)
      || secret.length !== REFRESH_SECRET_LENGTH
      || !REFRESH_SECRET_PATTERN.test(secret)
    ) {
      return null;
    }

    return { id, secret };
  }

  private createSecret() {
    return randomBytes(REFRESH_SECRET_BYTES).toString('base64url');
  }

  private hash(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private matches(secret: string, expectedHash: string) {
    const actual = Buffer.from(this.hash(secret), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private serialize(id: string, secret: string) {
    return `${id}.${secret}`;
  }

  private emitSessionRevoked(sessionId: string) {
    this.events.emit(AUTH_SESSION_REVOKED_EVENT, {
      sessionId,
    } satisfies AuthSessionRevokedEvent);
  }
}
