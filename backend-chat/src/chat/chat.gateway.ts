import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../messages/messages.service';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from 'src/common/index';
import { HybridThrottlerGuard } from '../common/guards/hybrid-throttler.guard';
import { PresenceService } from 'src/presence/presence.service';

interface AuthenticatedSocket extends Socket {
    user: {
        userId: number;
        username: string;
    };
}


@UseGuards(WsJwtGuard, HybridThrottlerGuard)
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
    @WebSocketServer() server: Server;

    constructor(
        private readonly messagesService: MessagesService,
        private readonly presenceService: PresenceService,
    ) { }

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
            sender: {
                id: senderId,
                username: client.user.username,
            },
        });

        return savedMsg;
    }

    // chat.gateway.ts

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

    // Trong ChatGateway
    @SubscribeMessage('heartbeat')
    async handleHeartbeat(@ConnectedSocket() client: any) {
        console.log('--- ĐÃ NHẬN HEARTBEAT TỪ USER:', client.user);
        const userId = client.user.userId;
        await this.presenceService.updateStatus(userId);
        return { status: 'ack' };
    }

}