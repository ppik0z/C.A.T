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

interface AuthenticatedSocket extends Socket {
    user: {
        userId: number;
        username: string;
    };
}
@UseGuards(WsJwtGuard)
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
    @WebSocketServer() server: Server;

    constructor(private readonly messagesService: MessagesService) { }

    // 1. Khi user vào một phòng chat cụ thể
    @SubscribeMessage('join_room')
    async handleJoinRoom(@MessageBody() data: { conversationId: number }, @ConnectedSocket() client: Socket) {
        await client.join(`conv_${data.conversationId}`);
    }

    // 2. Logic "Bắn" tin nhắn
    @SubscribeMessage('send_message')
    async handleMessage(
        @MessageBody() data: { conversationId: number; content: string },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        const senderId = client.user.userId;

        // BƯỚC 1: Lưu vào MySQL trước (Để có ID và thời gian chuẩn)
        const savedMsg = await this.messagesService.sendMessage(
            senderId,
            data.conversationId,
            data.content,
        );

        // BƯỚC 2: Bắn (Emit) tới tất cả mọi người trong phòng đó
        // Lưu ý: savedMsg lúc này đã có id từ insertId của Drizzle rồi
        this.server.to(`conv_${data.conversationId}`).emit('new_message', {
            ...savedMsg,
            sender: {
                id: senderId,
                username: client.user.username,
            },
        });

        return savedMsg;
    }
}