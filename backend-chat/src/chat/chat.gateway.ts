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
}