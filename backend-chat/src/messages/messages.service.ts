import { Injectable, ForbiddenException } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { messages, conversations, conversationMembers, messageStatuses } from '../database/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { EventEmitter2 } from '@nestjs/event-emitter';

export type MessageDeliveryStatus = 'sent' | 'delivered';

export interface MessageStatusSnapshot {
    messageId: number;
    userId: number;
    status: MessageDeliveryStatus;
    updatedAt: Date;
}

@Injectable()
export class MessagesService {
    constructor(
        private drizzle: DrizzleService,
        private eventEmitter: EventEmitter2
    ) { }

    //check quyền
    async validateMember(userId: number, conversationId: number) {
        const member = await this.drizzle.db
            .select({
                isAdmin: conversationMembers.isAdmin,
            })
            .from(conversationMembers)
            .where(and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, userId)
            ))
            .limit(1);

        if (member.length === 0) {
            throw new ForbiddenException('Bạn không có quyền trong phòng chat!');
        }
        return member[0];
    }

    async getConversationMemberIds(conversationId: number) {
        const members = await this.drizzle.db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, conversationId));

        return members.map((member) => member.userId);
    }


    //----sendMessage----
    async sendMessage(senderId: number, conversationId: number, content: string, senderName: string, clientTempId?: string) {
        await this.validateMember(senderId, conversationId);

        return await this.drizzle.db.transaction(async (tx) => {
            const [conv] = await tx.select({ currentIdx: conversations.lastMessageIndex })
                .from(conversations)
                .where(eq(conversations.id, conversationId))
                .for('update');

            const nextIndex = (conv?.currentIdx || 0) + 1;

            const [newMessage] = await tx.insert(messages).values({
                content,
                senderId,
                conversationId,
                type: 'text',
                conversationIndex: nextIndex,
            });

            const savedMsg = {
                id: newMessage.insertId,
                content,
                conversationId,
                senderId,
                senderName,
                conversationIndex: nextIndex,
                createdAt: new Date(),
                clientTempId,
            };

            const memberIds = await tx
                .select({ userId: conversationMembers.userId })
                .from(conversationMembers)
                .where(eq(conversationMembers.conversationId, conversationId));

            await tx.insert(messageStatuses).values(memberIds.map((member) => ({
                messageId: newMessage.insertId,
                userId: member.userId,
                status: 'sent',
            })));

            this.eventEmitter.emit('message.created', savedMsg);

            return savedMsg;
        });
    }

    async markMessageDelivered(userId: number, conversationId: number, messageId: number) {
        await this.validateMember(userId, conversationId);

        const [message] = await this.drizzle.db
            .select({
                id: messages.id,
                senderId: messages.senderId,
                conversationId: messages.conversationId,
            })
            .from(messages)
            .where(and(
                eq(messages.id, messageId),
                eq(messages.conversationId, conversationId),
            ))
            .limit(1);

        if (!message || message.senderId === userId) return null;

        await this.drizzle.db
            .insert(messageStatuses)
            .values({
                messageId,
                userId,
                status: 'delivered',
                updatedAt: new Date(),
            })
            .onDuplicateKeyUpdate({
                set: {
                    status: 'delivered',
                    updatedAt: new Date(),
                },
            });

        return {
            conversationId,
            messageId,
            userId,
            status: 'delivered' as const,
        };
    }

    //----getMessages----
    // TODO: Logic pagination
    async getMessages(userId: number, conversationId: number, limit = 20) {
        // 1. Kiểm tra quyền
        await this.validateMember(userId, conversationId);

        // 2. Lấy dữ liệu
        const results = await this.drizzle.db.query.messages.findMany({
            where: eq(messages.conversationId, conversationId),
            with: {
                sender: {
                    columns: { id: true, username: true, avatar: true }
                }
            },
            orderBy: (messages, { desc }) => [desc(messages.createdAt)],
            limit: limit,
        });

        return results.reverse();
    }

    async getMessageStatuses(messageIds: number[]): Promise<MessageStatusSnapshot[]> {
        if (messageIds.length === 0) return [];

        const rows = await this.drizzle.db
            .select({
                messageId: messageStatuses.messageId,
                userId: messageStatuses.userId,
                status: messageStatuses.status,
                updatedAt: messageStatuses.updatedAt,
            })
            .from(messageStatuses)
            .where(inArray(messageStatuses.messageId, messageIds));

        return rows.map((row) => ({
            messageId: row.messageId,
            userId: row.userId,
            status: row.status === 'delivered' ? 'delivered' : 'sent',
            updatedAt: row.updatedAt,
        }));
    }


}
