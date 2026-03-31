import { Injectable, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { friendships, users } from '../database/schema';
import { and, eq, like, ne, or } from 'drizzle-orm';

@Injectable()
export class FriendshipsService {
    constructor(private drizzle: DrizzleService) { }

    //----searchUsers----
    async searchUsers(query: string, currentUserId: number) {
        return await this.drizzle.db
            .select({
                id: users.id,
                username: users.username,
                avatar: users.avatar,
            })
            .from(users)
            .where(
                and(
                    like(users.username, `%${query}%`),
                    ne(users.id, currentUserId)
                )
            )
            .limit(10);
    }

    //----getMyFriends----    
    async getMyFriends(userId: number) {
        return await this.drizzle.db
            .select({
                friendInfo: {
                    id: users.id,
                    username: users.username,
                    avatar: users.avatar,
                }
            })
            .from(friendships)
            .innerJoin(users, eq(friendships.friendId, users.id))
            .where(
                and(
                    eq(friendships.userId, userId),
                    eq(friendships.status, 'accepted')
                )
            );
    }

    //----sendRequest-----
    async sendRequest(senderId: number, receiverId: number) {
        if (senderId === receiverId) throw new BadRequestException('Tự kết bạn với chính mình ??!!');
        const existing = await this.drizzle.db
            .select()
            .from(friendships)
            .where(
                or(
                    and(eq(friendships.userId, senderId), eq(friendships.friendId, receiverId)),
                    and(eq(friendships.userId, receiverId), eq(friendships.friendId, senderId))
                )
            )
            .limit(1);

        if (existing.length > 0) throw new BadRequestException('Đã có lời mời hoặc đã là bạn!');

        await this.drizzle.db.insert(friendships).values({
            userId: senderId,
            friendId: receiverId,
            senderId: senderId,
            status: 'pending',
        });

        return { message: 'Đã gửi lời mời kết bạn!' };
    }

    //----acceptRequest-----
    async acceptRequest(currentUserId: number, requesterId: number) {
        // Tìm lời mời đang pending
        const [request] = await this.drizzle.db
            .select()
            .from(friendships)
            .where(
                and(
                    eq(friendships.userId, requesterId),
                    eq(friendships.friendId, currentUserId),
                    eq(friendships.status, 'pending')
                )
            )
            .limit(1);

        if (!request) throw new BadRequestException('Không tìm thấy lời mời kết bạn này!');

        // Dùng TRANSACTION để đảm bảo hoặc có cả 2 dòng
        await this.drizzle.db.transaction(async (tx) => {
            await tx
                .update(friendships)
                .set({ status: 'accepted' })
                .where(eq(friendships.id, request.id));

            await tx.insert(friendships).values({
                userId: currentUserId,
                friendId: requesterId,
                senderId: request.senderId,
                status: 'accepted',
            });
        });

        return { message: 'Kết bạn thành công!' };
    }

    //----removeFriendship(unfriend)----
    async removeFriendship(currentUserId: number, targetId: number) {
        const [record] = await this.drizzle.db
            .select()
            .from(friendships)
            .where(
                and(
                    eq(friendships.userId, currentUserId),
                    eq(friendships.friendId, targetId)
                )
            )
            .limit(1);

        if (!record) {
            throw new BadRequestException('Không phải bạn bè nên không thể xóa!');
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

        return { message: 'Đã xóa mối quan hệ thành công!' };
    }

    //----getPendingRequests----    
    async getPendingRequests(currentUserId: number) {
        return await this.drizzle.db
            .select({
                id: friendships.id,
                sender: {
                    id: users.id,
                    username: users.username,
                    avatar: users.avatar,
                },
                createdAt: friendships.createdAt,
            })
            .from(friendships)
            .innerJoin(users, eq(friendships.userId, users.id))
            .where(
                and(
                    eq(friendships.friendId, currentUserId),
                    eq(friendships.status, 'pending')
                )
            );
    }
}
