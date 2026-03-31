import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { conversationMembers, conversations, users } from 'src/database/schema';
import { and, desc, eq, inArray, like, ne, or, sql } from 'drizzle-orm';

@Injectable()
export class ConversationsService {
    constructor(private drizzle: DrizzleService) { }

    //----getConversation(tự tạo phòng nếu chưa có)----
    async getConversation(user1Id: number, user2Id: number) {
        const existing = await this.drizzle.db
            .select({ id: conversations.id })
            .from(conversations)
            .innerJoin(conversationMembers, eq(conversations.id, conversationMembers.conversationId))
            .where(and(
                eq(conversations.isGroup, false),
                or(
                    eq(conversationMembers.userId, user1Id),
                    eq(conversationMembers.userId, user2Id)
                )
            ))
            .groupBy(conversations.id)
            .having(sql`count(${conversations.id}) = 2`)
            .limit(1);

        if (existing.length > 0) return existing[0];

        // Chưa có -> Tạo mới
        return await this.drizzle.db.transaction(async (tx) => {
            const [newConv] = await tx.insert(conversations).values({
                isGroup: false,
            });

            await tx.insert(conversationMembers).values([
                { userId: user1Id, conversationId: newConv.insertId },
                { userId: user2Id, conversationId: newConv.insertId },
            ]);

            return { id: newConv.insertId };
        });
    }

    //----getMyConversations----
    async getMyConversations(currentUserId: number) {
        const userConvs = await this.drizzle.db
            .select({ conversationId: conversationMembers.conversationId })
            .from(conversationMembers)
            .where(eq(conversationMembers.userId, currentUserId));

        const convIds = userConvs.map(c => c.conversationId);
        if (convIds.length === 0) return [];

        return await this.drizzle.db
            .select({
                id: conversations.id,
                name: conversations.name,
                isGroup: conversations.isGroup,
                avatarGroup: conversations.avatarGroup,
                friend: {
                    id: users.id,
                    username: users.username,
                    avatar: users.avatar,
                },
            })
            .from(conversations)
            .leftJoin(conversationMembers, and(
                eq(conversations.id, conversationMembers.conversationId),
                ne(conversationMembers.userId, currentUserId)
            ))
            .leftJoin(users, eq(conversationMembers.userId, users.id))
            .where(inArray(conversations.id, convIds))
            .orderBy(desc(conversations.updatedAt));
    }


}
