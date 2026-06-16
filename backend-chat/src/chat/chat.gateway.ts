import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { MessagesService, type CallEventSnapshot } from '../messages/messages.service';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from 'src/common/index';
import type { AuthenticatedSocket } from 'src/common/index';
import { HybridThrottlerGuard } from '../common/guards/hybrid-throttler.guard';
import { PresenceService } from 'src/presence/presence.service';
import { FriendshipsService } from 'src/friendships/friendships.service';
import { SkipThrottle } from '@nestjs/throttler';
import { conversationMembers, conversations } from '../database/schema';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { ReadStateService } from '../read-state/read-state.service';
import { OnEvent } from '@nestjs/event-emitter';
import { ConversationsService } from '../conversations/conversations.service';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import type { PublicUserProfileDto, PublicUserSummaryDto } from '../profiles/profiles.service';
import {
    AUTH_SESSION_REVOKED_EVENT,
    AUTH_USER_SESSIONS_REVOKED_EVENT,
    type AuthSessionRevokedEvent,
    type AuthUserSessionsRevokedEvent,
} from '../auth/auth-session.events';


@UseGuards(WsJwtGuard, HybridThrottlerGuard)
@WebSocketGateway()
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
        await Promise.all([
            client.join(`user_${userId}`),
            client.join(`session_${client.user.sessionId}`),
        ]);

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

    @OnEvent('message.created')
    async handleMessageCreated(payload: {
        id: number;
        content: string;
        previewContent: string;
        type: string;
        fileUrl?: string | null;
        filePublicId?: string | null;
        fileResourceType?: string | null;
        fileName?: string | null;
        fileMimeType?: string | null;
        fileSizeBytes?: number | null;
        fileFormat?: string | null;
        fileWidth?: number | null;
        fileHeight?: number | null;
        fileThumbnailUrl?: string | null;
        fileDurationSeconds?: number | null;
        callSessionId?: number | null;
        callEvent?: CallEventSnapshot | null;
        conversationId: number;
        senderId: number;
        senderName: string;
        conversationIndex: number;
        createdAt: Date;
        clientTempId?: string;
        clientMessageId?: string | null;
        replyToMessageId?: number | null;
        mentionedUserIds?: number[];
        sender: PublicUserSummaryDto;
    }) {
        const members = await this.drizzle.db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, payload.conversationId));

        if (payload.callEvent) {
            const participantStatusByUserId = new Map(
                payload.callEvent.participants.map((participant) => [participant.userId, participant.status]),
            );
            members.forEach((member) => {
                this.server.to(`user_${member.userId}`).emit('new_message', {
                    ...payload,
                    callEvent: {
                        ...payload.callEvent,
                        currentUserStatus: participantStatusByUserId.get(member.userId) ?? 'none',
                    },
                });
            });
        } else {
            // Phát tới room cá nhân của từng thành viên (luôn được join khi kết nối) thay vì
            // room `conv_` (chỉ join khi mở chat). Nhờ vậy realtime không còn phụ thuộc vào
            // thời điểm join_room, loại bỏ lỗ hổng mất tin đầu tiên khi vừa mở/đua join-load.
            members.forEach((member) => {
                this.server.to(`user_${member.userId}`).emit('new_message', payload);
            });
        }

        members.forEach((member) => {
            this.server.to(`user_${member.userId}`).emit('update_conversation_list', {
                conversationId: payload.conversationId,
                lastMessageContent: payload.previewContent,
                senderName: payload.senderName,
                lastMessageId: payload.id,
                lastMessageIndex: payload.conversationIndex,
                lastMessageType: payload.type,
            });
        });

        payload.mentionedUserIds?.filter((userId) => userId !== payload.senderId).forEach((userId) => {
            this.server.to(`user_${userId}`).emit('mention_received', {
                conversationId: payload.conversationId,
                messageId: payload.id,
                senderId: payload.senderId,
                senderName: payload.senderName,
            });
        });
    }

    @OnEvent(AUTH_SESSION_REVOKED_EVENT)
    disconnectRevokedSession({ sessionId }: AuthSessionRevokedEvent) {
        this.server.in(`session_${sessionId}`).disconnectSockets(true);
    }

    @OnEvent(AUTH_USER_SESSIONS_REVOKED_EVENT)
    disconnectRevokedUserSessions({ userId }: AuthUserSessionsRevokedEvent) {
        this.server.in(`user_${userId}`).disconnectSockets(true);
    }


    @SkipThrottle()
    @SubscribeMessage('join_room')
    async handleJoinRoom(@MessageBody() data: { conversationId: number }, @ConnectedSocket() client: AuthenticatedSocket): Promise<void> {
        console.log("User joined room: ", data.conversationId);
        await this.messagesService.validateMember(client.user.userId, data.conversationId);
        await client.join(`conv_${data.conversationId}`);
    }

    @SubscribeMessage('send_message')
    async handleMessage(
        @MessageBody() data: { conversationId: number; content?: string, clientTempId?: string, clientMessageId?: string, type?: 'text' | 'gif', fileUrl?: string, replyToMessageId?: number, mentionedUserIds?: number[], mentionEveryone?: boolean },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        const senderId = client.user.userId;

        return this.messagesService.sendMessage(
            senderId,
            data.conversationId,
            data.content ?? '',
            data.clientTempId,
            {
                type: data.type,
                content: data.content,
                fileUrl: data.fileUrl,
                clientTempId: data.clientTempId,
                clientMessageId: data.clientMessageId,
                replyToMessageId: data.replyToMessageId,
                mentionedUserIds: data.mentionedUserIds,
                mentionEveryone: data.mentionEveryone,
            },
        );
    }

    @SubscribeMessage('message:reaction:set')
    async handleSetReaction(
        @MessageBody() data: { conversationId: number; messageId: number; emoji: string },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        const delta = await this.messagesService.setReaction(client.user.userId, data);
        this.server.to(`conv_${data.conversationId}`).emit('message:reaction:updated', delta);
        return delta;
    }

    @SubscribeMessage('message:reaction:remove')
    async handleRemoveReaction(
        @MessageBody() data: { conversationId: number; messageId: number },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        const delta = await this.messagesService.removeReaction(client.user.userId, data);
        this.server.to(`conv_${data.conversationId}`).emit('message:reaction:updated', delta);
        return delta;
    }

    @SubscribeMessage('message:recall')
    async handleRecallMessage(
        @MessageBody() data: { conversationId: number; messageId: number },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        const delta = await this.messagesService.recallMessage(client.user.userId, data);
        this.server.to(`conv_${data.conversationId}`).emit('message:recalled', delta);
        if (delta.lastMessage) {
            const [conversation] = await this.drizzle.db
                .select({ lastMessageIndex: conversations.lastMessageIndex })
                .from(conversations)
                .where(eq(conversations.id, data.conversationId))
                .limit(1);
            const members = await this.drizzle.db
                .select({ userId: conversationMembers.userId })
                .from(conversationMembers)
                .where(eq(conversationMembers.conversationId, data.conversationId));

            members.forEach((member) => {
                this.server.to(`user_${member.userId}`).emit('update_conversation_list', {
                    conversationId: data.conversationId,
                    lastMessageContent: delta.lastMessage?.content ?? 'Tin nhắn đã được thu hồi',
                    senderName: client.user.displayName || client.user.username,
                    lastMessageId: data.messageId,
                    lastMessageIndex: conversation?.lastMessageIndex ?? 0,
                    lastMessageType: 'text',
                    isRecallUpdate: true,
                });
            });
        }
        return delta;
    }

    @OnEvent('user.profile.updated')
    handleUserProfileUpdated(profile: PublicUserProfileDto) {
        this.server.emit('user_profile_updated', profile);
    }

    @SubscribeMessage('load_messages')
    async handleLoadMessages(
        @MessageBody() data: { conversationId: number, limit?: number, beforeIndex?: number, afterIndex?: number, anchorIndex?: number },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        try {
            const window = await this.messagesService.getMessageWindow(client.user.userId, {
                conversationId: data.conversationId,
                limit: data.limit,
                beforeIndex: data.beforeIndex,
                afterIndex: data.afterIndex,
                anchorIndex: data.anchorIndex,
            });
            const messageStatuses = await this.messagesService.getMessageStatuses(window.messages.map((message) => message.id));
            const memberReadStates = await this.readStateService.getMemberReadStates(data.conversationId);

            return {
                event: 'load_messages_success',
                data: {
                    conversationId: data.conversationId,
                    messages: window.messages,
                    messageStatuses,
                    memberReadStates,
                    pageInfo: window.pageInfo,
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

    @SubscribeMessage('search_messages')
    async handleSearchMessages(
        @MessageBody() data: { conversationId: number; keyword: string; limit?: number },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        try {
            const results = await this.messagesService.searchMessages(client.user.userId, {
                conversationId: data.conversationId,
                keyword: data.keyword,
                limit: data.limit,
            });

            return {
                event: 'search_messages_success',
                data: {
                    conversationId: data.conversationId,
                    keyword: data.keyword,
                    results,
                },
            };
        } catch (error: unknown) {
            return {
                event: 'search_messages_error',
                data: {
                    conversationId: data.conversationId,
                    message: error instanceof Error ? error.message : 'Không thể tìm kiếm tin nhắn',
                },
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

        // Chặn user đánh dấu đã đọc cho phòng họ không thuộc (tránh giả mạo read receipt).
        await this.messagesService.validateMember(userId, data.conversationId);

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
            displayName: client.user.displayName,
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
            displayName: client.user.displayName,
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
            displayName: client.user.displayName,
            isTyping: false,
        });
    }

    private getTypingKey(conversationId: number, userId: number) {
        return `typing:${conversationId}:${userId}`;
    }


}
