import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { CallsService } from './calls.service';
import { DrizzleService } from '../database/drizzle.service';
import { MessagesService } from '../messages/messages.service';

describe('CallsService', () => {
    let service: CallsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CallsService,
                {
                    provide: DrizzleService,
                    useValue: { db: {} },
                },
                {
                    provide: RedisService,
                    useValue: {
                        getOrThrow: jest.fn(() => ({
                            get: jest.fn(),
                            set: jest.fn(),
                            del: jest.fn(),
                            smembers: jest.fn(() => []),
                            srem: jest.fn(),
                            multi: jest.fn(() => ({
                                set: jest.fn().mockReturnThis(),
                                del: jest.fn().mockReturnThis(),
                                sadd: jest.fn().mockReturnThis(),
                                srem: jest.fn().mockReturnThis(),
                                exec: jest.fn(),
                            })),
                        })),
                    },
                },
                {
                    provide: MessagesService,
                    useValue: { createCallEventMessage: jest.fn() },
                },
            ],
        }).compile();

        service = module.get<CallsService>(CallsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
