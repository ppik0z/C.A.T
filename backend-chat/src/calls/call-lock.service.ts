import { ConflictException, Injectable } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

const DEFAULT_LOCK_TTL_MS = 5_000;
const DEFAULT_LOCK_WAIT_MS = 900;
const DEFAULT_LOCK_RETRY_DELAY_MS = 50;

export interface CallLockOptions {
    ttlMs?: number;
    waitMs?: number;
    retryDelayMs?: number;
}

@Injectable()
export class CallLockService {
    private readonly redis: Redis;

    constructor(private readonly redisService: RedisService) {
        this.redis = this.redisService.getOrThrow();
    }

    async withCallLock<T>(callId: number, task: () => Promise<T>, options?: CallLockOptions): Promise<T> {
        return this.withLock(`call:${callId}:lock`, task, options);
    }

    async withConversationCreateLock<T>(conversationId: number, task: () => Promise<T>, options?: CallLockOptions): Promise<T> {
        return this.withLock(`call:create-lock:conversation:${conversationId}`, task, options);
    }

    async withLock<T>(key: string, task: () => Promise<T>, options: CallLockOptions = {}): Promise<T> {
        const ttlMs = options.ttlMs ?? DEFAULT_LOCK_TTL_MS;
        const waitMs = options.waitMs ?? DEFAULT_LOCK_WAIT_MS;
        const retryDelayMs = options.retryDelayMs ?? DEFAULT_LOCK_RETRY_DELAY_MS;
        const token = randomUUID();
        const deadline = Date.now() + waitMs;

        while (true) {
            const acquired = await this.redis.set(key, token, 'PX', ttlMs, 'NX');

            if (acquired === 'OK') {
                try {
                    return await task();
                } finally {
                    await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
                }
            }

            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0) break;

            await this.delay(Math.min(this.getRetryDelayMs(retryDelayMs), remainingMs));
        }

        throw new ConflictException('Cuộc gọi đang được xử lý, thử lại sau.');
    }

    private getRetryDelayMs(retryDelayMs: number) {
        if (retryDelayMs <= 0) return 0;
        return retryDelayMs + Math.floor(Math.random() * retryDelayMs);
    }

    private delay(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
