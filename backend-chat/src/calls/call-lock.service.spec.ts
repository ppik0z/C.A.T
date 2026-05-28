import { ConflictException } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Test, TestingModule } from '@nestjs/testing';
import { CallLockService } from './call-lock.service';

describe('CallLockService', () => {
    let service: CallLockService;
    let redisClient: {
        set: jest.Mock;
        eval: jest.Mock;
    };

    beforeEach(async () => {
        redisClient = {
            set: jest.fn(),
            eval: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CallLockService,
                {
                    provide: RedisService,
                    useValue: {
                        getOrThrow: jest.fn(() => redisClient),
                    },
                },
            ],
        }).compile();

        service = module.get<CallLockService>(CallLockService);
    });

    it('runs the task and releases the lock with a token check', async () => {
        redisClient.set.mockResolvedValue('OK');
        const task = jest.fn(async () => 'done');

        await expect(service.withCallLock(10, task)).resolves.toBe('done');

        expect(task).toHaveBeenCalledTimes(1);
        expect(redisClient.set).toHaveBeenCalledWith('call:10:lock', expect.any(String), 'PX', 5000, 'NX');
        expect(redisClient.eval).toHaveBeenCalledWith(expect.stringContaining('redis.call("GET"'), 1, 'call:10:lock', expect.any(String));
    });

    it('rejects when the lock is already held', async () => {
        redisClient.set.mockResolvedValue(null);

        await expect(service.withCallLock(10, async () => 'done', { waitMs: 0 })).rejects.toBeInstanceOf(ConflictException);
        expect(redisClient.eval).not.toHaveBeenCalled();
    });

    it('retries short lock contention before failing the action', async () => {
        redisClient.set
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce('OK');
        const task = jest.fn(async () => 'done');

        await expect(service.withCallLock(10, task, { waitMs: 100, retryDelayMs: 0 })).resolves.toBe('done');

        expect(redisClient.set).toHaveBeenCalledTimes(2);
        expect(task).toHaveBeenCalledTimes(1);
        expect(redisClient.eval).toHaveBeenCalledTimes(1);
    });
});
