import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { DrizzleService } from '../database/drizzle.service';
import Redis from 'ioredis';
import { conversationMembers } from '../database/schema';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class ReadStateService {
    private readonly redis: Redis;
    private readonly logger = new Logger(ReadStateService.name);
    private readonly READ_STATE_TTL = 7 * 24 * 60 * 60; // 7 ngày

    constructor(
        private readonly redisService: RedisService,
        private readonly drizzle: DrizzleService,
    ) {
        this.redis = this.redisService.getOrThrow();
    }

    /**
     * API: Lưu mốc đọc vào Redis và đánh dấu cần đồng bộ
     */
    async markAsRead(userId: number, conversationId: number, lastSeenIndex: number) {
        const key = `read_states:${userId}`;

        const pipeline = this.redis.pipeline();
        pipeline.hset(key, conversationId.toString(), lastSeenIndex.toString());
        pipeline.sadd('dirty_read_users', userId.toString());
        pipeline.expire(key, this.READ_STATE_TTL);

        await pipeline.exec();
    }

    /**
     * CRONJOB: Đồng bộ mốc đọc xuống MySQL
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async syncReadStatesToDB() {
        const lockKey = 'sync_read_states_lock';
        const dirtySetKey = 'dirty_read_users';
        const processingSetKey = 'dirty_read_users_processing';

        const hasDirtyData = await this.redis.exists(dirtySetKey);
        if (!hasDirtyData) return;

        await this.redis.rename(dirtySetKey, processingSetKey);

        const userIds = await this.redis.smembers(processingSetKey);
        this.logger.log(`Đồng bộ ${userIds.length} users xuống MySQL...`);

        for (const userIdStr of userIds) {
            const userId = parseInt(userIdStr, 10);
            const key = `read_states:${userId}`;
            const states = await this.redis.hgetall(key);

            if (Object.keys(states).length === 0) continue;

            await this.drizzle.db.transaction(async (tx) => {
                for (const [convIdStr, indexStr] of Object.entries(states)) {
                    await tx.update(conversationMembers)
                        .set({ lastSeenMessageId: parseInt(indexStr, 10) })
                        .where(and(
                            eq(conversationMembers.userId, userId),
                            eq(conversationMembers.conversationId, parseInt(convIdStr, 10))
                        ));
                }
            });
        }

        await this.redis.del(processingSetKey);
        this.logger.log(`Đồng bộ hoàn tất!`);
    }
}