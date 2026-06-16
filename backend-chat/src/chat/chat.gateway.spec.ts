import { Server } from 'socket.io';
import { ChatGateway } from './chat.gateway';
import { MessagesService } from '../messages/messages.service';
import { PresenceService } from '../presence/presence.service';
import { FriendshipsService } from '../friendships/friendships.service';
import { DrizzleService } from '../database/drizzle.service';
import { ReadStateService } from '../read-state/read-state.service';
import { ConversationsService } from '../conversations/conversations.service';
import { RedisService } from '@liaoliaots/nestjs-redis';

type MessageCreatedPayload = Parameters<ChatGateway['handleMessageCreated']>[0];

interface EmittedEvent {
    room: string;
    event: string;
    payload: unknown;
}

const buildMembersDb = (memberIds: number[]): DrizzleService => {
    const rows = memberIds.map((userId) => ({ userId }));
    const db = {
        select: () => ({
            from: () => ({
                where: () => Promise.resolve(rows),
            }),
        }),
    };
    return { db } as unknown as DrizzleService;
};

interface GatewayOverrides {
    messagesService?: Partial<MessagesService>;
    readStateService?: Partial<ReadStateService>;
}

const buildGateway = (memberIds: number[], overrides: GatewayOverrides = {}) => {
    const emitted: EmittedEvent[] = [];
    const server = {
        to: (room: string) => ({
            emit: (event: string, payload: unknown) => {
                emitted.push({ room, event, payload });
                return true;
            },
        }),
    } as unknown as Server;

    const redisService = { getOrThrow: () => ({}) } as unknown as RedisService;

    const gateway = new ChatGateway(
        (overrides.messagesService ?? {}) as MessagesService,
        {} as PresenceService,
        {} as FriendshipsService,
        buildMembersDb(memberIds),
        (overrides.readStateService ?? {}) as ReadStateService,
        {} as ConversationsService,
        redisService,
    );
    gateway.server = server;

    return { gateway, emitted };
};

const buildSocket = (userId: number) =>
    ({
        user: { userId, username: `user${userId}`, displayName: null, sessionId: 'sid' },
    }) as unknown as Parameters<ChatGateway['handleMarkAsRead']>[1];

const baseTextPayload = (conversationId: number): MessageCreatedPayload => ({
    id: 101,
    content: 'xin chào',
    previewContent: 'xin chào',
    type: 'text',
    conversationId,
    senderId: 1,
    senderName: 'Alice',
    conversationIndex: 5,
    createdAt: new Date(),
    sender: { id: 1, username: 'alice', displayName: 'Alice', avatar: null },
});

describe('ChatGateway.handleMessageCreated', () => {
    it('phát new_message tới room cá nhân của TỪNG thành viên, không qua room conv_', async () => {
        const conversationId = 42;
        const { gateway, emitted } = buildGateway([1, 2, 3]);

        await gateway.handleMessageCreated(baseTextPayload(conversationId));

        const newMessageEvents = emitted.filter((item) => item.event === 'new_message');
        const rooms = newMessageEvents.map((item) => item.room);

        expect(rooms).toEqual(expect.arrayContaining(['user_1', 'user_2', 'user_3']));
        expect(newMessageEvents).toHaveLength(3);
        // Không còn phụ thuộc vào việc join room conv_ để nhận tin realtime.
        expect(rooms).not.toContain(`conv_${conversationId}`);
        newMessageEvents.forEach((item) => {
            expect(item.payload).toMatchObject({ id: 101, conversationId });
        });
    });

    it('vẫn cập nhật danh sách hội thoại cho mọi thành viên qua room cá nhân', async () => {
        const { gateway, emitted } = buildGateway([1, 2]);

        await gateway.handleMessageCreated(baseTextPayload(7));

        const listEvents = emitted.filter((item) => item.event === 'update_conversation_list');
        expect(listEvents.map((item) => item.room)).toEqual(
            expect.arrayContaining(['user_1', 'user_2']),
        );
        expect(listEvents).toHaveLength(2);
    });

    it('tin call_event vẫn phát theo từng thành viên kèm currentUserStatus riêng', async () => {
        const { gateway, emitted } = buildGateway([1, 2]);

        const payload: MessageCreatedPayload = {
            ...baseTextPayload(9),
            type: 'call_event',
            callSessionId: 55,
            callEvent: {
                callId: 55,
                kind: 'audio',
                status: 'ended',
                endedReason: null,
                startedAt: new Date(),
                answeredAt: null,
                endedAt: null,
                durationSeconds: 0,
                startedByUserId: 1,
                currentUserStatus: 'none',
                participants: [
                    { userId: 1, status: 'joined' },
                    { userId: 2, status: 'missed' },
                ],
            },
        };

        await gateway.handleMessageCreated(payload);

        const newMessageEvents = emitted.filter((item) => item.event === 'new_message');
        const byRoom = new Map(newMessageEvents.map((item) => [item.room, item.payload]));

        expect(byRoom.get('user_1')).toMatchObject({
            callEvent: expect.objectContaining({ currentUserStatus: 'joined' }),
        });
        expect(byRoom.get('user_2')).toMatchObject({
            callEvent: expect.objectContaining({ currentUserStatus: 'missed' }),
        });
    });
});

describe('ChatGateway.handleMarkAsRead', () => {
    it('chặn user không thuộc phòng: không ghi read-state, không broadcast', async () => {
        const validateMember = jest.fn().mockRejectedValue(new Error('Bạn không có quyền trong phòng chat!'));
        const markAsRead = jest.fn();
        const { gateway, emitted } = buildGateway([1, 2], {
            messagesService: { validateMember },
            readStateService: { markAsRead },
        });

        await expect(
            gateway.handleMarkAsRead({ conversationId: 99, lastMessageIndex: 10 }, buildSocket(7)),
        ).rejects.toThrow();

        expect(validateMember).toHaveBeenCalledWith(7, 99);
        expect(markAsRead).not.toHaveBeenCalled();
        expect(emitted).toHaveLength(0);
    });

    it('cho phép thành viên hợp lệ: ghi read-state và broadcast', async () => {
        const validateMember = jest.fn().mockResolvedValue({ isAdmin: false });
        const markAsRead = jest.fn().mockResolvedValue(undefined);
        const { gateway, emitted } = buildGateway([1, 2], {
            messagesService: { validateMember },
            readStateService: { markAsRead },
        });

        await gateway.handleMarkAsRead({ conversationId: 5, lastMessageIndex: 12 }, buildSocket(1));

        expect(validateMember).toHaveBeenCalledWith(1, 5);
        expect(markAsRead).toHaveBeenCalledWith(1, 5, 12);
        expect(emitted.map((item) => item.event)).toEqual(
            expect.arrayContaining(['sync_read_state', 'read_state_updated']),
        );
    });
});
