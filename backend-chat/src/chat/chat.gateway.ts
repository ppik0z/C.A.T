import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../messages/messages.service';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from 'src/common/index';
import type { AuthenticatedSocket } from 'src/common/index';
import { HybridThrottlerGuard } from '../common/guards/hybrid-throttler.guard';
import { PresenceService } from 'src/presence/presence.service';
import { FriendshipsService } from 'src/friendships/friendships.service';
import { SkipThrottle } from '@nestjs/throttler';
import { conversationMembers } from '../database/schema';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { ReadStateService } from '../read-state/read-state.service';
import { OnEvent } from '@nestjs/event-emitter';
import { ConversationsService } from '../conversations/conversations.service';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';


@UseGuards(WsJwtGuard, HybridThrottlerGuard)
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private offlineTimers = new Map<number, NodeJS.Timeout>();
    private readonly redis: Redis;
    private readonly typingTtlSeconds = 6;

    constructor(
        private readonly messagesService: MessagesService,
        private readonly presenceService: PresenceService,
        private readonly friendshipsService: FriendshipsService,
        private drizzle: DrizzleService,
        private readonly readStateService: ReadStateService,
        private readonly conversationsService: ConversationsService,
        private readonly redisService: RedisService,
    ) {
        this.redis = this.redisService.getOrThrow();
    }

    async handleConnection(client: AuthenticatedSocket) {
        const userId = client.user?.userId;
        if (!userId) return;

        // noti_channel
        await client.join(`user_${userId}`);

        if (this.offlineTimers.has(userId)) {
            clearTimeout(this.offlineTimers.get(userId));
            this.offlineTimers.delete(userId);
            console.log(`User ${userId} đã quay lại!`);
        } else {
            this.server.emit('user_status_changed', { userId, status: 'online' });
        }

        const friends = await this.friendshipsService.getMyFriends(userId);
        const onlineIds = await this.presenceService.getOnlineUsers(friends.map(f => f.id));
        client.emit('initial_presence_sync', { onlineUserIds: onlineIds });
    }

    handleDisconnect(client: AuthenticatedSocket) {
        const userId = client.user?.userId;
        console.log(`User ${userId} đã rời đi!`);
        if (!userId) return;

        //chờ 10 giây trước khi thực sự báo Offline
        const timer = setTimeout(() => {
            void (async () => {
                await this.presenceService.removeStatus(userId);
                this.server.emit('user_status_changed', { userId, status: 'offline' });
                this.offlineTimers.delete(userId);
            })();
        }, 10000);

        this.offlineTimers.set(userId, timer);
    }

    @SkipThrottle()
    @SubscribeMessage('heartbeat')
    async handleHeartbeat(@ConnectedSocket() client: AuthenticatedSocket) {
        const userId = client.user.userId;
        await this.presenceService.updateStatus(userId);
        return { status: 'ack' };
    }

    @OnEvent('conversation.upsert')
    async handleConversationUpsert(payload: { userIds: number[]; conversationId: number }) {
        await Promise.all(payload.userIds.map(async (userId) => {
            const conversation = await this.conversationsService.buildConversationForUser(userId, payload.conversationId);
            this.server.to(`user_${userId}`).emit('conversation_upsert', conversation);
        }));
    }

    @OnEvent('conversation.removed')
    handleConversationRemoved(payload: { userId: number; conversationId: number }) {
        this.server.to(`user_${payload.userId}`).emit('conversation_removed', {
            conversationId: payload.conversationId,
        });
    }


    @SkipThrottle()
    @SubscribeMessage('join_room')
    async handleJoinRoom(@MessageBody() data: { conversationId: number }, @ConnectedSocket() client: Socket): Promise<void> {
        console.log("User joined room: ", data.conversationId);
        await client.join(`conv_${data.conversationId}`);
    }

    @SubscribeMessage('send_message')
    async handleMessage(
        @MessageBody() data: { conversationId: number; content: string, senderName: string, clientTempId?: string },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        const senderId = client.user.userId;

        // 1. Lưu tin nhắn
        const savedMsg = await this.messagesService.sendMessage(senderId, data.conversationId, data.content, data.senderName, data.clientTempId);

        // 2. Phát cho những người ĐANG MỞ PHÒNG
        this.server.to(`conv_${data.conversationId}`).emit('new_message', {
            ...savedMsg,
            senderId: senderId,
            sender: { id: senderId, username: data.senderName },
        });

        // 3. Tìm những người trong cuộc trò chuyện
        const members = await this.drizzle.db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, data.conversationId));

        // Bắn thông báo 'update_conversation_list' thẳng vào kênh cá nhân của từng người
        members.forEach((m) => {
            this.server.to(`user_${m.userId}`).emit('update_conversation_list', {
                conversationId: data.conversationId,
                lastMessageContent: data.content,
                senderName: data.senderName,
                lastMessageId: savedMsg.id,
                lastMessageIndex: savedMsg.conversationIndex,
            });
        });

        return savedMsg;
    }

    @SubscribeMessage('load_messages')
    async handleLoadMessages(
        @MessageBody() data: { conversationId: number, limit?: number },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        try {
            const history = await this.messagesService.getMessages(
                client.user.userId,
                data.conversationId,
                data.limit || 20
            );
            const messageStatuses = await this.messagesService.getMessageStatuses(history.map((message) => message.id));
            const memberReadStates = await this.readStateService.getMemberReadStates(data.conversationId);

            return {
                event: 'load_messages_success',
                data: {
                    conversationId: data.conversationId,
                    messages: history,
                    messageStatuses,
                    memberReadStates,
                },
            };
        } catch (error: unknown) {
            let errorMessage = 'Không thể tải tin nhắn';

            if (error instanceof Error) {
                errorMessage = error.message;
            }

            return {
                event: 'error',
                message: errorMessage,
            };
        }
    }

    @SkipThrottle()
    @SubscribeMessage('message_delivered')
    async handleMessageDelivered(
        @MessageBody() data: { conversationId: number; messageId: number },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        const statusUpdate = await this.messagesService.markMessageDelivered(
            client.user.userId,
            data.conversationId,
            data.messageId,
        );

        if (statusUpdate) {
            this.server.to(`conv_${data.conversationId}`).emit('message_status_updated', statusUpdate);
        }

        return { status: 'ack' };
    }

    @SkipThrottle()
    @SubscribeMessage('mark_as_read')
    async handleMarkAsRead(
        @MessageBody() data: { conversationId: number; lastMessageIndex: number },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        const userId = client.user.userId;

        // 1. Quăng vào Redis
        await this.readStateService.markAsRead(userId, data.conversationId, data.lastMessageIndex);

        // 2. Bắn loa về Kênh Cá Nhân để TẤT CẢ các tab của user này đều tắt chấm đỏ
        this.server.to(`user_${userId}`).emit('sync_read_state', {
            conversationId: data.conversationId,
            lastMessageIndex: data.lastMessageIndex
        });

        this.server.to(`conv_${data.conversationId}`).emit('read_state_updated', {
            conversationId: data.conversationId,
            userId,
            username: client.user.username,
            lastSeenMessageIndex: data.lastMessageIndex,
        });

        return { status: 'ack' };
    }

    @SkipThrottle()
    @SubscribeMessage('typing_start')
    async handleTypingStart(
        @MessageBody() data: { conversationId: number },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        await this.messagesService.validateMember(client.user.userId, data.conversationId);
        await this.redis.set(
            this.getTypingKey(data.conversationId, client.user.userId),
            client.user.username,
            'EX',
            this.typingTtlSeconds,
        );

        client.to(`conv_${data.conversationId}`).emit('typing_state_changed', {
            conversationId: data.conversationId,
            userId: client.user.userId,
            username: client.user.username,
            isTyping: true,
        });

        return { status: 'ack' };
    }

    @SkipThrottle()
    @SubscribeMessage('typing_stop')
    async handleTypingStop(
        @MessageBody() data: { conversationId: number },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        await this.messagesService.validateMember(client.user.userId, data.conversationId);
        await this.clearTypingState(client, data.conversationId);

        return { status: 'ack' };
    }

    private async clearTypingState(client: AuthenticatedSocket, conversationId: number) {
        await this.redis.del(this.getTypingKey(conversationId, client.user.userId));
        client.to(`conv_${conversationId}`).emit('typing_state_changed', {
            conversationId,
            userId: client.user.userId,
            username: client.user.username,
            isTyping: false,
        });
    }

    private getTypingKey(conversationId: number, userId: number) {
        return `typing:${conversationId}:${userId}`;
    }


}
