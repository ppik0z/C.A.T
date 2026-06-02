import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { and, eq, gt, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { authSessions, conversationMembers, pushSubscriptions, userSettings } from '../database/schema';
import { DrizzleService } from '../database/drizzle.service';
import type { RegisterFcmSubscriptionDto } from './dto/push-subscription.dto';

export interface ActiveFcmSubscription {
  showNotificationPreview: boolean;
  token: string;
  userId: number;
}

@Injectable()
export class PushSubscriptionsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async registerFcm(userId: number, authSessionId: string, input: RegisterFcmSubscriptionDto, userAgent?: string) {
    const tokenHash = this.hash(input.token);
    const now = new Date();
    await this.assertActiveSession(userId, authSessionId);

    await this.drizzle.db.transaction(async (tx) => {
      await tx
        .update(pushSubscriptions)
        .set({ revokedAt: now })
        .where(and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.authSessionId, authSessionId),
          eq(pushSubscriptions.installationId, input.installationId),
          isNull(pushSubscriptions.revokedAt),
        ));

      await tx
        .insert(pushSubscriptions)
        .values({
          userId,
          authSessionId,
          installationId: input.installationId,
          provider: 'fcm',
          token: input.token,
          subscriptionHash: tokenHash,
          userAgent: userAgent?.slice(0, 255) || null,
          lastSeenAt: now,
          revokedAt: null,
        })
        .onDuplicateKeyUpdate({
          set: {
            userId,
            authSessionId,
            installationId: input.installationId,
            provider: 'fcm',
            token: input.token,
            userAgent: userAgent?.slice(0, 255) || null,
            lastSeenAt: now,
            revokedAt: null,
          },
        });
    });

    return { registered: true as const };
  }

  async revokeInstallation(userId: number, authSessionId: string, installationId: string) {
    await this.drizzle.db
      .update(pushSubscriptions)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.authSessionId, authSessionId),
        eq(pushSubscriptions.installationId, installationId),
        isNull(pushSubscriptions.revokedAt),
      ));

    return { revoked: true as const };
  }

  async revokeForSerializedSession(serializedToken: string | null) {
    if (!serializedToken) return;
    const [authSessionId] = serializedToken.split('.');
    if (!authSessionId) return;

    await this.revokeForSession(authSessionId);
  }

  async revokeForSession(authSessionId: string) {
    await this.drizzle.db
      .update(pushSubscriptions)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(pushSubscriptions.authSessionId, authSessionId),
        isNull(pushSubscriptions.revokedAt),
      ));
  }

  async revokeAllForUser(userId: number) {
    await this.drizzle.db
      .update(pushSubscriptions)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(pushSubscriptions.userId, userId),
        isNull(pushSubscriptions.revokedAt),
      ));
  }

  async revokeTokens(tokens: string[]) {
    if (tokens.length === 0) return;

    await this.drizzle.db
      .update(pushSubscriptions)
      .set({ revokedAt: new Date() })
      .where(inArray(pushSubscriptions.subscriptionHash, tokens.map((token) => this.hash(token))));
  }

  async getActiveFcmSubscriptions(userIds: number[]): Promise<ActiveFcmSubscription[]> {
    if (userIds.length === 0) return [];

    const rows = await this.drizzle.db
      .select({
        token: pushSubscriptions.token,
        userId: pushSubscriptions.userId,
        showNotificationPreview: userSettings.showNotificationPreview,
      })
      .from(pushSubscriptions)
      .innerJoin(authSessions, eq(pushSubscriptions.authSessionId, authSessions.id))
      .leftJoin(userSettings, eq(pushSubscriptions.userId, userSettings.userId))
      .where(and(
        inArray(pushSubscriptions.userId, userIds),
        eq(pushSubscriptions.provider, 'fcm'),
        isNotNull(pushSubscriptions.token),
        isNull(pushSubscriptions.revokedAt),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ));

    return rows.filter((row): row is typeof row & { token: string } => Boolean(row.token)).map((row) => ({
      token: row.token,
      userId: row.userId,
      showNotificationPreview: row.showNotificationPreview ?? true,
    }));
  }

  async getConversationRecipientIds(conversationId: number, senderId: number) {
    const rows = await this.drizzle.db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(and(
        eq(conversationMembers.conversationId, conversationId),
        ne(conversationMembers.userId, senderId),
      ));

    return rows.map((row) => row.userId);
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async assertActiveSession(userId: number, authSessionId: string) {
    const [session] = await this.drizzle.db
      .select({ id: authSessions.id })
      .from(authSessions)
      .where(and(
        eq(authSessions.id, authSessionId),
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ))
      .limit(1);

    if (!session) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực.');
    }
  }
}
