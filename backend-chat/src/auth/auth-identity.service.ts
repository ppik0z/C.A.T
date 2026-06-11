import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { AuthenticatedUser, JwtPayload } from '../common';
import { authSessions, users } from '../database/schema';
import { DrizzleService } from '../database/drizzle.service';

@Injectable()
export class AuthIdentityService {
  constructor(private readonly drizzle: DrizzleService) {}

  async resolve(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    if (!Number.isInteger(payload.userId) || !payload.sid) return null;

    const [identity] = await this.drizzle.db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        sessionId: authSessions.id,
      })
      .from(users)
      .innerJoin(
        authSessions,
        and(
          eq(authSessions.id, payload.sid),
          eq(authSessions.userId, users.id),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .where(eq(users.id, payload.userId))
      .limit(1);

    return identity ?? null;
  }
}
