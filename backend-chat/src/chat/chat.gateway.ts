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
    ) { }

    async handleConnection(client: any) {
        const userId = client.user?.userId;
        console.log(`User ${userId} đã kết nối!`);
        if (!userId) return;

        // 1. Hủy hẹn giờ Offline nếu user quay lại kịp lúc
        if (this.offlineTimers.has(userId)) {
            clearTimeout(this.offlineTimers.get(userId));
            this.offlineTimers.delete(userId);
            console.log(`User ${userId} đã quay lại!`);
        } else {
            // 2. Nếu là login mới hoàn toàn, báo cho mọi người
            this.server.emit('user_status_changed', { userId, status: 'online' });
        }

        // 3. Snapshot: Gửi danh sách bạn bè đang online về cho chính user này
        const friends = await this.friendshipsService.getMyFriends(userId);
        const onlineIds = await this.presenceService.getOnlineUsers(friends.map(f => f.friendInfo.id));
        client.emit('initial_presence_sync', { onlineUserIds: onlineIds });
    }

    handleDisconnect(client: any) {
        const userId = client.user?.userId;
        console.log(`User ${userId} đã rời đi!`);
        if (!userId) return;

        // Đưa vào danh sách chờ 10 giây trước khi thực sự báo Offline
        const timer = setTimeout(() => {
            // Gọi một hàm async tự thực thi bên trong
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

        console.log("Socket User Data:", client.user);
        const senderId = client.user.userId;

        const savedMsg = await this.messagesService.sendMessage(
            senderId,
            data.conversationId,
            data.content,
        );

        //emit tới tất cả mọi người trong phòng
        this.server.to(`conv_${data.conversationId}`).emit('new_message', {
            ...savedMsg,
            senderId: senderId,
            sender: {
                id: senderId,
                username: client.user.username,
            },
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