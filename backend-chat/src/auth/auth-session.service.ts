import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { authSessions } from '../database/schema';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthSessionService {
  constructor(private readonly drizzle: DrizzleService) {}

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
    return this.serialize(id, secret);
  }

  async rotate(serializedToken: string) {
    const { id, secret } = this.parse(serializedToken);
    const [session] = await this.drizzle.db
      .select()
      .from(authSessions)
      .where(and(
        eq(authSessions.id, id),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ))
      .limit(1);

    if (!session || !this.matches(secret, session.refreshTokenHash)) {
      if (session) await this.revoke(id);
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }

    const nextSecret = this.createSecret();
    await this.drizzle.db
      .update(authSessions)
      .set({ refreshTokenHash: this.hash(nextSecret), lastUsedAt: new Date() })
      .where(eq(authSessions.id, id));

    return { userId: session.userId, refreshToken: this.serialize(id, nextSecret) };
  }

  async revokeSerialized(serializedToken: string | null) {
    if (!serializedToken) return;
    const [id] = serializedToken.split('.');
    if (id) await this.revoke(id);
  }

  async revokeAllForUser(userId: number) {
    await this.drizzle.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  }

  private async revoke(id: string) {
    await this.drizzle.db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, id));
  }

  private parse(serializedToken: string) {
    const [id, secret] = serializedToken.split('.');
    if (!id || !secret) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ.');
    return { id, secret };
  }

  private createSecret() {
    return randomBytes(32).toString('base64url');
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
}
