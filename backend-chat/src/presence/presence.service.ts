import { Injectable } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

@Injectable()
export class PresenceService {
    private readonly redis: Redis | null;

    constructor(private readonly redisService: RedisService) {
        this.redis = this.redisService.getOrThrow(); // Lấy client Redis
    }

    async updateStatus(userId: number) {
        const key = `presence:user:${userId}`;
        await this.redis?.set(key, 'online', 'EX', 25);
    }

    // Check user có đang online hay không
    async isUserOnline(userId: number): Promise<boolean> {
        const key = `presence:user:${userId}`;
        const result = await this.redis?.exists(key);
        return result === 1;
    }

    // Get danh sách user online
    async getOnlineUsers(userIds: number[]): Promise<number[]> {
        if (!userIds || userIds.length === 0) return [];

        const checks = userIds.map((id) => this.isUserOnline(id));
        const results = await Promise.all(checks);

        return userIds.filter((_, index) => results[index]);
    }

    // Xóa status của user
    async removeStatus(userId: number) {
        const key = `presence:user:${userId}`;
        await this.redis?.del(key);
    }
}