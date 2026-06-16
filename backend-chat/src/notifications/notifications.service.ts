import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, count, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { notifications, users } from '../database/schema';
import type {
  CreateNotificationInput,
  NotificationDto,
  NotificationListResult,
  NotificationMetadata,
  NotificationType,
} from './notifications.types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Tạo một thông báo, lưu DB rồi phát event để gateway đẩy realtime. */
  async create(input: CreateNotificationInput): Promise<NotificationDto | null> {
    try {
      const [inserted] = await this.drizzle.db
        .insert(notifications)
        .values({
          userId: input.userId,
          type: input.type,
          actorId: input.actorId ?? null,
          conversationId: input.conversationId ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          title: input.title.slice(0, 255),
          body: input.body.slice(0, 500),
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        })
        .$returningId();

      const dto = await this.findById(input.userId, inserted.id);
      if (dto) {
        this.eventEmitter.emit('notification.created', { userId: input.userId, notification: dto });
      }
      return dto;
    } catch (error) {
      this.logger.error('Không thể tạo thông báo.', error instanceof Error ? error.stack : String(error));
      return null;
    }
  }

  async listForUser(
    userId: number,
    options: { limit?: number; beforeId?: number } = {},
  ): Promise<NotificationListResult> {
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const rows = await this.drizzle.db
      .select(this.rowSelection())
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .where(
        options.beforeId
          ? and(eq(notifications.userId, userId), lt(notifications.id, options.beforeId))
          : eq(notifications.userId, userId),
      )
      .orderBy(desc(notifications.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => this.toDto(row));
    const unreadCount = await this.getUnreadCount(userId);

    return { items, unreadCount, hasMore };
  }

  async getUnreadCount(userId: number): Promise<number> {
    const [row] = await this.drizzle.db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return Number(row?.value ?? 0);
  }

  async markRead(userId: number, ids: number[]): Promise<{ unreadCount: number }> {
    if (ids.length > 0) {
      await this.drizzle.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, userId),
            inArray(notifications.id, ids),
            isNull(notifications.readAt),
          ),
        );
    }
    return { unreadCount: await this.getUnreadCount(userId) };
  }

  async markAllRead(userId: number): Promise<{ unreadCount: number }> {
    await this.drizzle.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { unreadCount: 0 };
  }

  async remove(userId: number, id: number): Promise<{ unreadCount: number }> {
    await this.drizzle.db
      .delete(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.id, id)));
    return { unreadCount: await this.getUnreadCount(userId) };
  }

  /** Dọn thông báo cũ khi sự kiện nguồn bị huỷ (vd: rút lại lời mời kết bạn). */
  async removeByActor(userId: number, type: NotificationType, actorId: number): Promise<void> {
    try {
      await this.drizzle.db
        .delete(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, type),
            eq(notifications.actorId, actorId),
          ),
        );
    } catch (error) {
      this.logger.error('Không thể xoá thông báo.', error instanceof Error ? error.stack : String(error));
    }
  }

  private async findById(userId: number, id: number): Promise<NotificationDto | null> {
    const [row] = await this.drizzle.db
      .select(this.rowSelection())
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .where(and(eq(notifications.userId, userId), eq(notifications.id, id)))
      .limit(1);
    return row ? this.toDto(row) : null;
  }

  private rowSelection() {
    return {
      id: notifications.id,
      type: notifications.type,
      conversationId: notifications.conversationId,
      title: notifications.title,
      body: notifications.body,
      metadata: notifications.metadata,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorId: notifications.actorId,
      actorDisplayName: users.displayName,
      actorAvatar: users.avatar,
    };
  }

  private toDto(row: {
    id: number;
    type: string;
    conversationId: number | null;
    title: string | null;
    body: string | null;
    metadata: string | null;
    readAt: Date | null;
    createdAt: Date;
    actorId: number | null;
    actorDisplayName: string | null;
    actorAvatar: string | null;
  }): NotificationDto {
    const metadata = this.parseMetadata(row.metadata);
    return {
      id: row.id,
      type: row.type,
      actor: row.actorId
        ? { id: row.actorId, displayName: row.actorDisplayName, avatar: row.actorAvatar }
        : null,
      conversationId: row.conversationId,
      title: row.title ?? '',
      body: row.body ?? '',
      link: typeof metadata?.link === 'string' ? metadata.link : null,
      metadata,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private parseMetadata(raw: string | null): NotificationMetadata | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as NotificationMetadata;
    } catch {
      return null;
    }
  }
}
