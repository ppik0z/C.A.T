import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CallsService } from './calls.service';
import { CallLockService } from './call-lock.service';
import { DrizzleService } from '../database/drizzle.service';
import { MessagesService } from '../messages/messages.service';

describe('CallsService', () => {
    let service: CallsService;
    let redisClient: {
        get: jest.Mock;
        set: jest.Mock;
        del: jest.Mock;
        smembers: jest.Mock;
        srem: jest.Mock;
        multi: jest.Mock;
    };
    let drizzleDb: {
        transaction: jest.Mock;
        update: jest.Mock;
    };
    let eventEmitter: { emit: jest.Mock };
    let callLockService: {
        withCallLock: jest.Mock;
        withConversationCreateLock: jest.Mock;
    };

    const chain = () => ({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
    });

    const redisMulti = () => ({
        set: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        sadd: jest.fn().mockReturnThis(),
        srem: jest.fn().mockReturnThis(),
        exec: jest.fn(),
    });

    const baseState = () => ({
        id: 10,
        conversationId: 20,
        isGroup: true,
        kind: 'video' as const,
        status: 'active' as const,
        provider: 'livekit' as const,
        roomName: 'livekit_conv_20_10',
        startedBy: {
            id: 1,
            username: 'starter',
            avatar: null,
        },
        startedAt: new Date(Date.now() - 10_000).toISOString(),
        answeredAt: new Date(Date.now() - 5_000).toISOString(),
        endedAt: null,
        endedReason: null,
        ringExpiresAt: null,
        participants: [
            {
                userId: 1,
                username: 'starter',
                avatar: null,
                status: 'joined' as const,
                micEnabled: true,
                cameraEnabled: true,
                joinedAt: new Date(Date.now() - 10_000).toISOString(),
                leftAt: null,
                declinedAt: null,
                lastHeartbeatAt: new Date().toISOString(),
                mediaStatus: 'connected' as const,
                mediaConnectedAt: new Date(Date.now() - 4_000).toISOString(),
                mediaDisconnectedAt: null,
                mediaFailureReason: null,
            },
            {
                userId: 2,
                username: 'guest',
                avatar: null,
                status: 'declined' as const,
                micEnabled: false,
                cameraEnabled: false,
                joinedAt: null,
                leftAt: null,
                declinedAt: new Date(Date.now() - 2_000).toISOString(),
                lastHeartbeatAt: null,
                mediaStatus: 'idle' as const,
                mediaConnectedAt: null,
                mediaDisconnectedAt: null,
                mediaFailureReason: null,
            },
        ],
    });

    beforeEach(async () => {
        redisClient = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            smembers: jest.fn(() => []),
            srem: jest.fn(),
            multi: jest.fn(redisMulti),
        };
        drizzleDb = {
            transaction: jest.fn(async (callback: (tx: { update: jest.Mock }) => unknown) => {
                return callback({ update: jest.fn(() => chain()) });
            }),
            update: jest.fn(() => chain()),
        };
        eventEmitter = { emit: jest.fn() };
        callLockService = {
            withCallLock: jest.fn(async (_callId: number, task: () => Promise<unknown>) => task()),
            withConversationCreateLock: jest.fn(async (_conversationId: number, task: () => Promise<unknown>) => task()),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CallsService,
                {
                    provide: DrizzleService,
                    useValue: { db: drizzleDb },
                },
                {
                    provide: RedisService,
                    useValue: {
                        getOrThrow: jest.fn(() => redisClient),
                    },
                },
                {
                    provide: MessagesService,
                    useValue: { createCallEventMessage: jest.fn() },
                },
                {
                    provide: EventEmitter2,
                    useValue: eventEmitter,
                },
                {
                    provide: CallLockService,
                    useValue: callLockService,
                },
            ],
        }).compile();

        service = module.get<CallsService>(CallsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('allows a declined participant to join an active group call again', async () => {
        jest.spyOn(service as unknown as { getAccessibleState: jest.Mock }, 'getAccessibleState').mockResolvedValue(baseState());
        jest.spyOn(service as unknown as { ensureConversationMember: jest.Mock }, 'ensureConversationMember').mockResolvedValue({
            conversationId: 20,
            isGroup: true,
        });
        redisClient.get.mockResolvedValue(null);

        const result = await service.joinCall(2, 10);
        const participant = result.state.participants.find((item) => item.userId === 2);

        expect(participant?.status).toBe('joined');
        expect(participant?.declinedAt).toBeNull();
        expect(result.ended).toBe(false);
    });

    it('rejects rejoin after a participant is marked missed', async () => {
        const state = baseState();
        state.participants[1] = {
            ...state.participants[1],
            status: 'missed',
        };
        jest.spyOn(service as unknown as { getAccessibleState: jest.Mock }, 'getAccessibleState').mockResolvedValue(state);
        redisClient.get.mockResolvedValue(null);

        await expect(service.joinCall(2, 10)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('emits call.ended when ringing cleanup marks a call missed', async () => {
        const state = {
            ...baseState(),
            status: 'ringing' as const,
            answeredAt: null,
            ringExpiresAt: new Date(Date.now() - 1000).toISOString(),
            participants: baseState().participants.map((participant, index) => ({
                ...participant,
                status: index === 0 ? 'joined' as const : 'ringing' as const,
            })),
        };

        redisClient.smembers.mockResolvedValue(['10']);
        jest.spyOn(service as unknown as { getStoredState: jest.Mock }, 'getStoredState').mockResolvedValue(state);

        await service.cleanupExpiredCalls();

        expect(eventEmitter.emit).toHaveBeenCalledWith(
            'call.ended',
            expect.objectContaining({
                callId: 10,
                ended: true,
            }),
        );
    });

    it('does not clear another participant joined key during heartbeat', async () => {
        const state = baseState();
        state.participants[1] = {
            ...state.participants[1],
            status: 'joined',
            joinedAt: new Date(Date.now() - 5_000).toISOString(),
            lastHeartbeatAt: new Date(Date.now() - 5_000).toISOString(),
        };
        jest.spyOn(service as unknown as { getAccessibleState: jest.Mock }, 'getAccessibleState').mockResolvedValue(state);

        await service.heartbeat(1, 10);

        expect(redisClient.del).not.toHaveBeenCalledWith('call:user:2:joined');
        expect(redisClient.set).toHaveBeenCalledWith('call:user:1:joined', '10', 'EX', expect.any(Number));
    });

    it('only clears joined keys for stale participants during cleanup', async () => {
        const state = baseState();
        state.participants = state.participants.map((participant, index) => ({
            ...participant,
            status: 'joined',
            joinedAt: new Date(Date.now() - 120_000).toISOString(),
            lastHeartbeatAt: new Date(Date.now() - (index === 0 ? 5_000 : 120_000)).toISOString(),
        }));

        redisClient.smembers.mockResolvedValue(['10']);
        jest.spyOn(service as unknown as { getStoredState: jest.Mock }, 'getStoredState').mockResolvedValue(state);

        await service.cleanupExpiredCalls();

        expect(redisClient.del).toHaveBeenCalledWith('call:user:2:joined');
        expect(redisClient.del).not.toHaveBeenCalledWith('call:user:1:joined');
        expect(eventEmitter.emit).toHaveBeenCalledWith('call.state_changed', expect.objectContaining({ callId: 10 }));
    });

    it('returns media token context only for a joined LiveKit participant', async () => {
        jest.spyOn(service as unknown as { getAccessibleState: jest.Mock }, 'getAccessibleState').mockResolvedValue(baseState());

        await expect(service.getMediaTokenContext(1, 10)).resolves.toMatchObject({
            callId: 10,
            conversationId: 20,
            provider: 'livekit',
            roomName: 'livekit_conv_20_10',
            user: {
                id: 1,
                username: 'starter',
            },
        });
        await expect(service.getMediaTokenContext(2, 10)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates media connection status for a joined participant', async () => {
        jest.spyOn(service as unknown as { getAccessibleState: jest.Mock }, 'getAccessibleState').mockResolvedValue(baseState());

        const result = await service.updateMediaConnectionStatus(1, 10, { status: 'reconnecting' });
        const participant = result.state.participants.find((item) => item.userId === 1);

        expect(participant?.mediaStatus).toBe('reconnecting');
        expect(eventEmitter.emit).toHaveBeenCalledWith('call.state_changed', expect.objectContaining({ callId: 10 }));
    });
});
