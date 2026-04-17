import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { conversationMembers, conversations, messages, users } from 'src/database/schema';
import { and, desc, eq, inArray, like, ne, or, sql } from 'drizzle-orm';
import { PresenceService } from '../presence/presence.service';
import { aliasedTable } from 'drizzle-orm';

type RawConvType = {
    id: number;
    name: string | null;
    isGroup: boolean;
    avatarGroup: string | null;
    lastMessageId: number | null;
    lastMessageIndex: number;
    lastMessageContent: string | null;
    lastMessageSenderName: string | null;
    unreadCount: number;
    friendId: number | null;
    friendUsername: string | null;
    friendAvatar: string | null;
};

@Injectable()
export class ConversationsService {
    constructor(
        private drizzle: DrizzleService,
        private presenceService: PresenceService
    ) { }

    //----getConversation(tự tạo phòng nếu chưa có)----
    // Hàm để lấy conversation cụ thể sử dụng 2 userId
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
    // Hàm để lấy danh sách các conversations của một userId
    async getMyConversations(currentUserId: number) {
        const userConvs = await this.drizzle.db
            .select({ conversationId: conversationMembers.conversationId })
            .from(conversationMembers)
            .where(eq(conversationMembers.userId, currentUserId));

        const convIds = userConvs.map(c => c.conversationId);
        if (convIds.length === 0) return [];

        const myMember = aliasedTable(conversationMembers, 'myMember');
        const friendMember = aliasedTable(conversationMembers, 'friendMember');

        // 1. SELECT
        const rawConvs = await this.drizzle.db
            .select({
                id: conversations.id,
                name: conversations.name,
                isGroup: conversations.isGroup,
                avatarGroup: conversations.avatarGroup,
                lastMessageId: conversations.lastMessageId,
                lastMessageIndex: conversations.lastMessageIndex,
                lastMessageContent: conversations.lastMessageContent,
                lastMessageSenderName: conversations.lastMessageSenderName,
                unreadCount: sql<number>`CAST(GREATEST(${conversations.lastMessageIndex} - COALESCE(${myMember.lastSeenMessageIndex}, 0), 0) AS UNSIGNED)`,
                friendId: users.id,
                friendUsername: users.username,
                friendAvatar: users.avatar,
            })
            .from(conversations)
            .innerJoin(myMember, and(
                eq(conversations.id, myMember.conversationId),
                eq(myMember.userId, currentUserId)
            ))
            .leftJoin(friendMember, and(
                eq(conversations.id, friendMember.conversationId),
                ne(friendMember.userId, currentUserId),
                eq(conversations.isGroup, false)
            ))
            .leftJoin(users, eq(friendMember.userId, users.id))
            .where(inArray(conversations.id, convIds))
            .orderBy(desc(conversations.updatedAt)) as RawConvType[];

        // 2. GỘP OBJECT
        return await Promise.all(rawConvs.map(async (conv) => {
            let isOnline = false;
            if (!conv.isGroup && conv.friendId) {
                isOnline = await this.presenceService.isUserOnline(conv.friendId);
            }

            return {
                id: conv.id,
                name: conv.name,
                isGroup: conv.isGroup,
                avatarGroup: conv.avatarGroup,
                unreadCount: conv.unreadCount,
                isOnline,
                friend: conv.friendId ? {
                    id: conv.friendId,
                    username: conv.friendUsername,
                    avatar: conv.friendAvatar,
                } : null,
                lastMessage: {
                    id: conv.lastMessageId,
                    content: conv.lastMessageContent,
                    senderName: conv.lastMessageSenderName,
                }
            };
        }));
    }
}