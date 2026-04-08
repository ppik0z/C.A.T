import { Injectable, ForbiddenException } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { messages, conversations, conversationMembers } from '../database/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class MessagesService {
    constructor(private drizzle: DrizzleService) { }

    //check quyền
    private async validateMember(userId: number, conversationId: number) {
        const member = await this.drizzle.db
            .select()
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




    //----sendMessage----
    async sendMessage(senderId: number, conversationId: number, content: string) {

        // 1. Kiểm tra quyền
        await this.validateMember(senderId, conversationId);

        // 2. Gửi tin nhắn
        return await this.drizzle.db.transaction(async (tx) => {
            const [newMessage] = await tx.insert(messages).values({
                content,
                senderId,
                conversationId,
                type: 'text',
            });

            await tx
                .update(conversations)
                .set({ updatedAt: new Date() })
                .where(eq(conversations.id, conversationId));

            return { id: newMessage.insertId, content, createdAt: new Date() };
        });
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


}