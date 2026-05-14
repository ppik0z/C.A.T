import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { aliasedTable, and, desc, eq, like, ne, or } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { conversationMembers, conversations, friendships, users } from '../database/schema';
import { PresenceService } from '../presence/presence.service';

export type RelationshipStatus = 'none' | 'incoming_pending' | 'outgoing_pending' | 'friends';
export type FriendRequestListType = 'incoming' | 'outgoing';

export interface FriendUserDto {
    id: number;
    username: string;
    avatar: string | null;
    isOnline?: boolean;
    relationshipStatus?: RelationshipStatus;
    requestedAt?: Date;
    directConversationId?: number | null;
}

interface UserRow {
    id: number;
    username: string;
    avatar: string | null;
    createdAt?: Date;
}

interface FriendshipRow {
    id: number;
    userId: number;
    friendId: number;
    senderId: number;
    status: string;
    createdAt: Date;
}

@Injectable()
export class FriendshipsService {
    constructor(
        private drizzle: DrizzleService,
        private presenceService: PresenceService,
        private eventEmitter: EventEmitter2,
    ) { }

    async searchUsers(query: string, currentUserId: number): Promise<FriendUserDto[]> {
        const normalizedQuery = query?.trim();
        if (!normalizedQuery) return [];

        const matches = await this.drizzle.db
            .select({
                id: users.id,
                username: users.username,
                avatar: users.avatar,
            })
            .from(users)
            .where(
                and(
                    like(users.username, `%${normalizedQuery}%`),
                    ne(users.id, currentUserId)
                )
            )
            .limit(10);

        return this.withRelationshipStatuses(currentUserId, matches);
    }

    async getSuggestions(userId: number): Promise<FriendUserDto[]> {
        const candidates = await this.drizzle.db
            .select({
                id: users.id,
                username: users.username,
                avatar: users.avatar,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(ne(users.id, userId))
            .orderBy(desc(users.createdAt))
            .limit(30);

        const withStatuses = await this.withRelationshipStatuses(userId, candidates);
        return withStatuses
            .filter((candidate) => candidate.relationshipStatus === 'none')
            .slice(0, 10)
            .map((candidate) => ({
                ...candidate,
                relationshipStatus: 'none',
            }));
    }

    async getMyFriends(userId: number): Promise<FriendUserDto[]> {
        const rows = await this.drizzle.db
            .select({
                id: users.id,
                username: users.username,
                avatar: users.avatar,
            })
            .from(friendships)
            .innerJoin(users, eq(friendships.friendId, users.id))
            .where(
                and(
                    eq(friendships.userId, userId),
                    eq(friendships.status, 'accepted')
                )
            );

        return Promise.all(rows.map(async (friend) => ({
            ...friend,
            isOnline: await this.presenceService.isUserOnline(friend.id),
            relationshipStatus: 'friends' as const,
            directConversationId: await this.getDirectConversationId(userId, friend.id),
        })));
    }

    async sendRequest(senderId: number, receiverId: number) {
        if (senderId === receiverId) throw new BadRequestException('Không thể tự kết bạn với chính mình.');

        const existing = await this.findAnyRelationship(senderId, receiverId);
        if (existing?.status === 'accepted') throw new BadRequestException('Hai người đã là bạn bè.');
        if (existing?.status === 'pending') throw new BadRequestException('Đã có lời mời kết bạn đang chờ xử lý.');

        await this.drizzle.db.insert(friendships).values({
            userId: senderId,
            friendId: receiverId,
            senderId,
            status: 'pending',
        });

        this.eventEmitter.emit('friends.request.received', { senderId, receiverId });
        return { message: 'Đã gửi lời mời kết bạn!' };
    }

    async cancelRequest(senderId: number, receiverId: number) {
        const [request] = await this.drizzle.db
            .select()
            .from(friendships)
            .where(
                and(
                    eq(friendships.userId, senderId),
                    eq(friendships.friendId, receiverId),
                    eq(friendships.senderId, senderId),
                    eq(friendships.status, 'pending')
                )
            )
            .limit(1);

        if (!request) throw new BadRequestException('Không tìm thấy lời mời đã gửi để hủy.');

        await this.drizzle.db.transaction(async (tx) => {
            await tx.delete(friendships).where(eq(friendships.id, request.id));
        });

        this.eventEmitter.emit('friends.request.cancelled', { senderId, receiverId });
        return { message: 'Đã hủy lời mời kết bạn.' };
    }

    async acceptRequest(currentUserId: number, requesterId: number) {
        const [request] = await this.drizzle.db
            .select()
            .from(friendships)
            .where(
                and(
                    eq(friendships.userId, requesterId),
                    eq(friendships.friendId, currentUserId),
                    eq(friendships.senderId, requesterId),
                    eq(friendships.status, 'pending')
                )
            )
            .limit(1);

        if (!request) throw new BadRequestException('Không tìm thấy lời mời kết bạn này.');

        await this.drizzle.db.transaction(async (tx) => {
            await tx
                .update(friendships)
                .set({ status: 'accepted' })
                .where(eq(friendships.id, request.id));

            const [reverse] = await tx
                .select()
                .from(friendships)
                .where(
                    and(
                        eq(friendships.userId, currentUserId),
                        eq(friendships.friendId, requesterId)
                    )
                )
                .limit(1);

            if (!reverse) {
                await tx.insert(friendships).values({
                    userId: currentUserId,
                    friendId: requesterId,
                    senderId: request.senderId,
                    status: 'accepted',
                });
            }
        });

        this.eventEmitter.emit('friends.request.accepted', { requesterId, receiverId: currentUserId });
        return { message: 'Kết bạn thành công!' };
    }

    async rejectRequest(currentUserId: number, requesterId: number) {
        const [request] = await this.drizzle.db
            .select()
            .from(friendships)
            .where(
                and(
                    eq(friendships.userId, requesterId),
                    eq(friendships.friendId, currentUserId),
                    eq(friendships.senderId, requesterId),
                    eq(friendships.status, 'pending')
                )
            )
            .limit(1);

        if (!request) throw new BadRequestException('Không tìm thấy lời mời kết bạn để từ chối.');

        await this.drizzle.db.transaction(async (tx) => {
            await tx.delete(friendships).where(eq(friendships.id, request.id));
        });

        this.eventEmitter.emit('friends.request.rejected', { requesterId, receiverId: currentUserId });
        return { message: 'Đã từ chối lời mời kết bạn.' };
    }

    async removeFriendship(currentUserId: number, targetId: number) {
        const existing = await this.findAnyRelationship(currentUserId, targetId);
        if (!existing || existing.status !== 'accepted') {
            throw new BadRequestException('Hai người chưa phải bạn bè.');
        }

        await this.drizzle.db.transaction(async (tx) => {
            await tx
                .delete(friendships)
                .where(
                    or(
                        and(eq(friendships.userId, currentUserId), eq(friendships.friendId, targetId)),
                        and(eq(friendships.userId, targetId), eq(friendships.friendId, currentUserId))
                    )
                );
        });

        this.eventEmitter.emit('friends.removed', { userId: currentUserId, targetId });
        return { message: 'Đã hủy kết bạn.' };
    }

    async getPendingRequests(currentUserId: number, type: FriendRequestListType = 'incoming'): Promise<FriendUserDto[]> {
        const isOutgoing = type === 'outgoing';

        const rows = await this.drizzle.db
            .select({
                id: users.id,
                username: users.username,
                avatar: users.avatar,
                requestedAt: friendships.createdAt,
            })
            .from(friendships)
            .innerJoin(users, isOutgoing ? eq(friendships.friendId, users.id) : eq(friendships.userId, users.id))
            .where(
                and(
                    isOutgoing ? eq(friendships.userId, currentUserId) : eq(friendships.friendId, currentUserId),
                    eq(friendships.status, 'pending')
                )
            )
            .orderBy(desc(friendships.createdAt));

        return rows.map((row) => ({
            ...row,
            relationshipStatus: isOutgoing ? 'outgoing_pending' : 'incoming_pending',
        }));
    }

    private async findAnyRelationship(userAId: number, userBId: number): Promise<FriendshipRow | undefined> {
        const [record] = await this.drizzle.db
            .select()
            .from(friendships)
            .where(
                or(
                    and(eq(friendships.userId, userAId), eq(friendships.friendId, userBId)),
                    and(eq(friendships.userId, userBId), eq(friendships.friendId, userAId))
                )
            )
            .limit(1);

        return record as FriendshipRow | undefined;
    }

    private async withRelationshipStatuses(currentUserId: number, targetUsers: UserRow[]): Promise<FriendUserDto[]> {
        if (targetUsers.length === 0) return [];

        const relationships = await this.drizzle.db
            .select()
            .from(friendships)
            .where(
                or(
                    ...targetUsers.flatMap((targetUser) => [
                        and(eq(friendships.userId, currentUserId), eq(friendships.friendId, targetUser.id)),
                        and(eq(friendships.userId, targetUser.id), eq(friendships.friendId, currentUserId)),
                    ])
                )
            );

        return targetUsers.map((targetUser) => {
            const relationship = relationships.find((record) => {
                return (
                    (record.userId === currentUserId && record.friendId === targetUser.id) ||
                    (record.userId === targetUser.id && record.friendId === currentUserId)
                );
            });

            return {
                id: targetUser.id,
                username: targetUser.username,
                avatar: targetUser.avatar,
                relationshipStatus: this.getRelationshipStatus(currentUserId, relationship),
                requestedAt: relationship?.status === 'pending' ? relationship.createdAt : undefined,
            };
        });
    }

    private getRelationshipStatus(currentUserId: number, relationship?: FriendshipRow): RelationshipStatus {
        if (!relationship) return 'none';
        if (relationship.status === 'accepted') return 'friends';
        if (relationship.status === 'pending' && relationship.senderId === currentUserId) return 'outgoing_pending';
        return 'incoming_pending';
    }

    private async getDirectConversationId(userId: number, friendId: number): Promise<number | null> {
        const myMember = aliasedTable(conversationMembers, 'friendsMyMember');
        const friendMember = aliasedTable(conversationMembers, 'friendsFriendMember');

        const [conversation] = await this.drizzle.db
            .select({ id: conversations.id })
            .from(conversations)
            .innerJoin(myMember, and(
                eq(conversations.id, myMember.conversationId),
                eq(myMember.userId, userId)
            ))
            .innerJoin(friendMember, and(
                eq(conversations.id, friendMember.conversationId),
                eq(friendMember.userId, friendId)
            ))
            .where(eq(conversations.isGroup, false))
            .limit(1);

        return conversation?.id ?? null;
    }
}
