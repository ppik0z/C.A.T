import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DrizzleService } from '../database/drizzle.service';
import { conversations } from '../database/schema';
import { eq } from 'drizzle-orm';

export interface MessageCreatedEvent {
    id: number;
    content: string;
    previewContent: string;
    conversationId: number;
    type: string;
    senderId: number;
    senderName: string;
    conversationIndex: number;
    createdAt: Date;
}

@Injectable()
export class MessagesListener {
    constructor(private drizzle: DrizzleService) {}

    @OnEvent('message.created')
    async handleMessageCreated(payload: MessageCreatedEvent) {
        console.log('Listener đang xử lý tin nhắn:', payload.id);
        
        await this.drizzle.db
            .update(conversations)
            .set({
                lastMessageId: payload.id,
                lastMessageIndex: payload.conversationIndex,
                lastMessageContent: payload.previewContent,
                lastMessageSenderName: payload.senderName,
                lastMessageType: payload.type,
                updatedAt: new Date(), 
            })
            .where(eq(conversations.id, payload.conversationId));
    }
}
