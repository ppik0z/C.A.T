import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../database/drizzle.service';
import { conversationMembers, conversations, users } from '../database/schema';
import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { PresenceService } from '../presence/presence.service';
import { aliasedTable } from 'drizzle-orm';

interface CreateGroupInput {
    name: string;
    avatarGroup?: string | null;
    memberIds: number[];
}

interface UpdateGroupInput {
    name?: string;
    avatarGroup?: string | null;
}

interface ConversationRow {
    id: number;
    name: string | null;
    isGroup: boolean;
    avatarGroup: string | null;
    lastMessageId: number | null;
    lastMessageIndex: number;
    lastMessageContent: string | null;
    lastMessageSenderName: string | null;
    lastMessageType: string | null;
    unreadCount: number;
    lastSeenMessageIndex: number;
    isAdmin: boolean;
    memberCount: number;
    friendId: number | null;
    friendUsername: string | null;
    friendAvatar: string | null;
}

interface GroupMemberRow {
    id: number;
    userId: number;
    username: string | null;
    nickname: string | null;
    isAdmin: boolean;
    joinedAt: Date;
    avatar: string | null;
}

interface GroupMembership {
    id: number;
    userId: number;
    isAdmin: boolean;
}


@Injectable()
export class ConversationsService {
    constructor(
        private drizzle: DrizzleService,
        private presenceService: PresenceService,
        private eventEmitter: EventEmitter2,
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

        const rawConvs: ConversationRow[] = await this.drizzle.db
            .select({
                id: conversations.id,
                name: conversations.name,
                isGroup: conversations.isGroup,
                avatarGroup: conversations.avatarGroup,
                lastMessageId: conversations.lastMessageId,
                lastMessageIndex: conversations.lastMessageIndex,
                lastMessageContent: conversations.lastMessageContent,
                lastMessageSenderName: conversations.lastMessageSenderName,
                lastMessageType: conversations.lastMessageType,
                unreadCount: sql<number>`CAST(GREATEST(${conversations.lastMessageIndex} - COALESCE(${myMember.lastSeenMessageIndex}, 0), 0) AS UNSIGNED)`,
                lastSeenMessageIndex: myMember.lastSeenMessageIndex,
                isAdmin: myMember.isAdmin,
                memberCount: sql<number>`CAST((SELECT COUNT(*) FROM ${conversationMembers} WHERE ${conversationMembers.conversationId} = ${conversations.id}) AS UNSIGNED)`,
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
            .orderBy(desc(conversations.updatedAt)) as ConversationRow[];

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
                lastMessageIndex: conv.lastMessageIndex,
                lastSeenMessageIndex: conv.lastSeenMessageIndex,
                memberCount: conv.memberCount,
                myMember: {
                    userId: currentUserId,
                    isAdmin: conv.isAdmin,
                },
                myRole: conv.isAdmin ? 'admin' : 'member',
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
                    type: conv.lastMessageType,
                }
            };
        }));
    }

    async createGroup(creatorId: number, input: CreateGroupInput) {
        const name = input.name?.trim();
        if (!name) throw new BadRequestException('Tên nhóm không được để trống.');

        const selectedMemberIds = this.uniqueIds(input.memberIds).filter((id) => id !== creatorId);
        if (selectedMemberIds.length < 2) {
            throw new BadRequestException('Cần chọn ít nhất 2 thành viên ngoài bạn để tạo nhóm.');
        }

        const [creator] = await this.drizzle.db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, creatorId))
            .limit(1);
        if (!creator) throw new NotFoundException('Không tìm thấy người tạo nhóm.');

        const invitedUsers = await this.drizzle.db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(inArray(users.id, selectedMemberIds));

        if (invitedUsers.length !== selectedMemberIds.length) {
            throw new BadRequestException('Danh sách thành viên có người dùng không tồn tại.');
        }

        const conversationId = await this.drizzle.db.transaction(async (tx) => {
            const [newConv] = await tx.insert(conversations).values({
                name,
                isGroup: true,
                avatarGroup: input.avatarGroup?.trim() || null,
            });

            await tx.insert(conversationMembers).values([
                {
                    userId: creatorId,
                    username: creator.username,
                    conversationId: newConv.insertId,
                    isAdmin: true,
                },
                ...invitedUsers.map((user) => ({
                    userId: user.id,
                    username: user.username,
                    conversationId: newConv.insertId,
                    isAdmin: false,
                })),
            ]);

            return newConv.insertId;
        });

        this.emitConversationUpsert([creatorId, ...selectedMemberIds], conversationId);
        return this.buildConversationForUser(creatorId, conversationId);
    }

    async getConversationDetail(currentUserId: number, conversationId: number) {
        const summary = await this.buildConversationForUser(currentUserId, conversationId);
        const members = summary.isGroup ? await this.getConversationMembers(conversationId) : [];

        return {
            ...summary,
            members,
            memberCount: summary.isGroup ? members.length : summary.memberCount,
        };
    }

    async updateGroup(currentUserId: number, conversationId: number, input: UpdateGroupInput) {
        await this.ensureGroupAdmin(currentUserId, conversationId);

        const values: { name?: string; avatarGroup?: string | null } = {};
        if (input.name !== undefined) {
            const name = input.name.trim();
            if (!name) throw new BadRequestException('Tên nhóm không được để trống.');
            values.name = name;
        }
        if (input.avatarGroup !== undefined) {
            values.avatarGroup = input.avatarGroup?.trim() || null;
        }
        if (Object.keys(values).length === 0) {
            throw new BadRequestException('Không có thông tin nhóm để cập nhật.');
        }

        await this.drizzle.db.update(conversations).set(values).where(eq(conversations.id, conversationId));
        this.emitConversationUpsert(await this.getConversationMemberIds(conversationId), conversationId);
        return this.getConversationDetail(currentUserId, conversationId);
    }

    async addGroupMembers(currentUserId: number, conversationId: number, memberIds: number[]) {
        await this.ensureGroupAdmin(currentUserId, conversationId);

        const selectedIds = this.uniqueIds(memberIds).filter((id) => id !== currentUserId);
        if (selectedIds.length === 0) throw new BadRequestException('Cần chọn ít nhất 1 thành viên để thêm.');

        const existingMembers = await this.getConversationMemberIds(conversationId);
        const newIds = selectedIds.filter((id) => !existingMembers.includes(id));
        if (newIds.length === 0) return this.getConversationDetail(currentUserId, conversationId);

        const newUsers = await this.drizzle.db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(inArray(users.id, newIds));

        if (newUsers.length !== newIds.length) {
            throw new BadRequestException('Danh sách thành viên có người dùng không tồn tại.');
        }

        await this.drizzle.db.insert(conversationMembers).values(newUsers.map((user) => ({
            userId: user.id,
            username: user.username,
            conversationId,
            isAdmin: false,
        })));

        this.emitConversationUpsert([...existingMembers, ...newIds], conversationId);
        return this.getConversationDetail(currentUserId, conversationId);
    }

    async removeGroupMember(currentUserId: number, conversationId: number, targetUserId: number) {
        const currentMember = await this.ensureGroupMember(currentUserId, conversationId);
        const targetMember = await this.ensureGroupMember(targetUserId, conversationId);

        if (currentUserId !== targetUserId) {
            if (!currentMember.isAdmin) throw new ForbiddenException('Chỉ admin mới có thể xoá thành viên.');
            if (targetMember.isAdmin) throw new ForbiddenException('Không thể xoá admin khỏi nhóm ở phiên bản này.');
        }

        const membersBefore = await this.getConversationMemberIds(conversationId);
        await this.drizzle.db
            .delete(conversationMembers)
            .where(and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, targetUserId),
            ));

        const remainingMembers = membersBefore.filter((id) => id !== targetUserId);
        if (remainingMembers.length === 0) {
            await this.drizzle.db.delete(conversations).where(eq(conversations.id, conversationId));
            this.eventEmitter.emit('conversation.removed', { userId: targetUserId, conversationId });
            return { removed: true };
        }

        if (targetMember.isAdmin) {
            const [nextAdmin] = await this.drizzle.db
                .select({ userId: conversationMembers.userId })
                .from(conversationMembers)
                .where(eq(conversationMembers.conversationId, conversationId))
                .orderBy(asc(conversationMembers.joinedAt))
                .limit(1);

            if (nextAdmin) {
                await this.drizzle.db
                    .update(conversationMembers)
                    .set({ isAdmin: true })
                    .where(and(
                        eq(conversationMembers.conversationId, conversationId),
                        eq(conversationMembers.userId, nextAdmin.userId),
                    ));
            }
        }

        this.eventEmitter.emit('conversation.removed', { userId: targetUserId, conversationId });
        this.emitConversationUpsert(remainingMembers, conversationId);
        return { removed: true };
    }

    async buildConversationForUser(currentUserId: number, conversationId: number) {
        const [summary] = await this.getConversationRows(currentUserId, [conversationId]);
        if (!summary) throw new NotFoundException('Không tìm thấy đoạn chat hoặc bạn không có quyền truy cập.');

        let isOnline = false;
        if (!summary.isGroup && summary.friendId) {
            isOnline = await this.presenceService.isUserOnline(summary.friendId);
        }

        return {
            id: summary.id,
            name: summary.name,
            isGroup: summary.isGroup,
            avatarGroup: summary.avatarGroup,
            unreadCount: summary.unreadCount,
            lastMessageIndex: summary.lastMessageIndex,
            lastSeenMessageIndex: summary.lastSeenMessageIndex,
            memberCount: summary.memberCount,
            myMember: {
                userId: currentUserId,
                isAdmin: summary.isAdmin,
            },
            myRole: summary.isAdmin ? 'admin' : 'member',
            isOnline,
            friend: summary.friendId ? {
                id: summary.friendId,
                username: summary.friendUsername,
                avatar: summary.friendAvatar,
            } : null,
            lastMessage: {
                id: summary.lastMessageId,
                content: summary.lastMessageContent,
                senderName: summary.lastMessageSenderName,
                type: summary.lastMessageType,
            }
        };
    }

    private async getConversationRows(currentUserId: number, conversationIds: number[]) {
        if (conversationIds.length === 0) return [];

        const myMember = aliasedTable(conversationMembers, 'summaryMyMember');
        const friendMember = aliasedTable(conversationMembers, 'summaryFriendMember');

        return await this.drizzle.db
            .select({
                id: conversations.id,
                name: conversations.name,
                isGroup: conversations.isGroup,
                avatarGroup: conversations.avatarGroup,
                lastMessageId: conversations.lastMessageId,
                lastMessageIndex: conversations.lastMessageIndex,
                lastMessageContent: conversations.lastMessageContent,
                lastMessageSenderName: conversations.lastMessageSenderName,
                lastMessageType: conversations.lastMessageType,
                unreadCount: sql<number>`CAST(GREATEST(${conversations.lastMessageIndex} - COALESCE(${myMember.lastSeenMessageIndex}, 0), 0) AS UNSIGNED)`,
                lastSeenMessageIndex: myMember.lastSeenMessageIndex,
                isAdmin: myMember.isAdmin,
                memberCount: sql<number>`CAST((SELECT COUNT(*) FROM ${conversationMembers} WHERE ${conversationMembers.conversationId} = ${conversations.id}) AS UNSIGNED)`,
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
            .where(inArray(conversations.id, conversationIds)) as ConversationRow[];
    }

    private async getConversationMembers(conversationId: number) {
        const rows = await this.drizzle.db
            .select({
                id: conversationMembers.id,
                userId: conversationMembers.userId,
                username: conversationMembers.username,
                nickname: conversationMembers.nickname,
                isAdmin: conversationMembers.isAdmin,
                joinedAt: conversationMembers.joinedAt,
                avatar: users.avatar,
            })
            .from(conversationMembers)
            .leftJoin(users, eq(conversationMembers.userId, users.id))
            .where(eq(conversationMembers.conversationId, conversationId))
            .orderBy(desc(conversationMembers.isAdmin), asc(conversationMembers.joinedAt)) as GroupMemberRow[];

        return Promise.all(rows.map(async (member) => ({
            id: member.id,
            userId: member.userId,
            username: member.username ?? `User #${member.userId}`,
            nickname: member.nickname,
            isAdmin: member.isAdmin,
            joinedAt: member.joinedAt,
            avatar: member.avatar,
            isOnline: await this.presenceService.isUserOnline(member.userId),
        })));
    }

    private async ensureGroupMember(userId: number, conversationId: number): Promise<GroupMembership> {
        const [member] = await this.drizzle.db
            .select({
                id: conversationMembers.id,
                userId: conversationMembers.userId,
                isAdmin: conversationMembers.isAdmin,
                isGroup: conversations.isGroup,
            })
            .from(conversationMembers)
            .innerJoin(conversations, eq(conversationMembers.conversationId, conversations.id))
            .where(and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, userId),
            ))
            .limit(1);

        if (!member) throw new ForbiddenException('Bạn không có quyền trong phòng chat này.');
        if (!member.isGroup) throw new BadRequestException('Hành động này chỉ áp dụng cho chat nhóm.');

        return {
            id: member.id,
            userId: member.userId,
            isAdmin: member.isAdmin,
        };
    }

    private async ensureGroupAdmin(userId: number, conversationId: number) {
        const member = await this.ensureGroupMember(userId, conversationId);
        if (!member.isAdmin) throw new ForbiddenException('Chỉ admin mới có quyền quản lý nhóm.');
        return member;
    }

    private async getConversationMemberIds(conversationId: number) {
        const members = await this.drizzle.db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, conversationId));

        return members.map((member) => member.userId);
    }

    private emitConversationUpsert(userIds: number[], conversationId: number) {
        this.eventEmitter.emit('conversation.upsert', {
            userIds: this.uniqueIds(userIds),
            conversationId,
        });
    }

    private uniqueIds(ids: number[] | undefined) {
        return [...new Set((ids ?? []).filter((id) => Number.isInteger(id) && id > 0))];
    }
}
