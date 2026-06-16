import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import type { NotificationCreatedEvent } from './notifications.types';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway {
  @WebSocketServer() server: Server;

  @OnEvent('notification.created')
  handleNotificationCreated(payload: NotificationCreatedEvent) {
    this.server.to(`user_${payload.userId}`).emit('notification:new', payload.notification);
  }
}
