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
import { HybridThrottlerGuard } from '../common/guards/hybrid-throttler.guard';
import { PresenceService } from 'src/presence/presence.service';
import { FriendshipsService } from 'src/friendships/friendships.service';
import { SkipThrottle } from '@nestjs/throttler';
import { conversationMembers } from '../database/schema';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';

interface AuthenticatedSocket extends Socket {
    user: {
        userId: number;
        username: string;
    };
}


@UseGuards(WsJwtGuard, HybridThrottlerGuard)
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private offlineTimers = new Map<number, NodeJS.Timeout>();

    constructor(
        private readonly messagesService: MessagesService,
        private readonly presenceService: PresenceService,
        private readonly friendshipsService: FriendshipsService,
        private drizzle: DrizzleService
    ) { }

    async handleConnection(client: any) {
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
        const onlineIds = await this.presenceService.getOnlineUsers(friends.map(f => f.friendInfo.id));
        client.emit('initial_presence_sync', { onlineUserIds: onlineIds });
    }

    handleDisconnect(client: any) {
        const userId = client.user?.userId;
        console.log(`User ${userId} đã rời đi!`);
        if (!userId) return;

        //chờ 10 giây trước khi thực sự báo Offline
        const timer = setTimeout(() => {
            (async () => {
                await this.presenceService.removeStatus(userId);
                this.server.emit('user_status_changed', { userId, status: 'offline' });
                this.offlineTimers.delete(userId);
            })();
        }, 10000);

        this.offlineTimers.set(userId, timer);
    }

    @SkipThrottle()
    @SubscribeMessage('heartbeat')
    async handleHeartbeat(@ConnectedSocket() client: any) {
        const userId = client.user.userId;
        await this.presenceService.updateStatus(userId);
        return { status: 'ack' };
    }



    @SubscribeMessage('join_room')
    async handleJoinRoom(@MessageBody() data: { conversationId: number }, @ConnectedSocket() client: Socket) {
        console.log("User joined room: ", data.conversationId);
        await client.join(`conv_${data.conversationId}`);
    }

    @SubscribeMessage('send_message')
    async handleMessage(
        @MessageBody() data: { conversationId: number; content: string },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {

        const senderId = client.user.userId;

        // 1. Lưu tin nhắn
        const savedMsg = await this.messagesService.sendMessage(senderId, data.conversationId, data.content);

        // 2. Phát cho những người ĐANG MỞ PHÒNG
        this.server.to(`conv_${data.conversationId}`).emit('new_message', {
            ...savedMsg,
            senderId: senderId,
            sender: { id: senderId, username: client.user.username },
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
                lastMessage: data.content,
                senderName: client.user.username,
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

            return {
                event: 'load_messages_success',
                data: history,
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


}