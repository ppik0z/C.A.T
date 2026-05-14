import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class FriendsGateway {
    @WebSocketServer() server: Server;

    @OnEvent('friends.request.received')
    handleFriendRequestReceived(payload: { senderId: number; receiverId: number }) {
        this.server.to(`user_${payload.receiverId}`).emit('friend_request_received', payload);
    }

    @OnEvent('friends.request.cancelled')
    handleFriendRequestCancelled(payload: { senderId: number; receiverId: number }) {
        this.server.to(`user_${payload.receiverId}`).emit('friend_request_cancelled', payload);
    }

    @OnEvent('friends.request.accepted')
    handleFriendRequestAccepted(payload: { requesterId: number; receiverId: number }) {
        this.server.to(`user_${payload.requesterId}`).emit('friend_request_accepted', payload);
        this.server.to(`user_${payload.receiverId}`).emit('friend_request_accepted', payload);
    }

    @OnEvent('friends.request.rejected')
    handleFriendRequestRejected(payload: { requesterId: number; receiverId: number }) {
        this.server.to(`user_${payload.requesterId}`).emit('friend_request_rejected', payload);
    }

    @OnEvent('friends.removed')
    handleFriendRemoved(payload: { userId: number; targetId: number }) {
        this.server.to(`user_${payload.userId}`).emit('friend_removed', payload);
        this.server.to(`user_${payload.targetId}`).emit('friend_removed', payload);
    }
}
