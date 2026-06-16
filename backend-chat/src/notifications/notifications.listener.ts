import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { ProfilesService } from '../profiles/profiles.service';

interface MessageCreatedEvent {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  mentionedUserIds?: number[];
}

interface FriendRequestReceivedEvent {
  senderId: number;
  receiverId: number;
}

interface FriendRequestAcceptedEvent {
  requesterId: number;
  receiverId: number;
}

interface FriendRequestCancelledEvent {
  senderId: number;
  receiverId: number;
}

interface ConversationMembersAddedEvent {
  conversationId: number;
  groupName: string | null;
  actorId: number;
  addedUserIds: number[];
}

interface ConversationMemberKickedEvent {
  conversationId: number;
  groupName: string | null;
  actorId: number;
  targetUserId: number;
}

interface CallEndedEvent {
  callId: number;
  conversationId: number;
  state: {
    kind: 'audio' | 'video';
    status: string;
    startedBy: { id: number; username: string; displayName: string | null; avatar: string | null };
    participants: { userId: number; status: string }[];
  };
}

const FRIENDS_LINK = '/?view=friends';
const conversationLink = (conversationId: number) => `/?conversationId=${conversationId}`;

@Injectable()
export class NotificationsListener {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly profilesService: ProfilesService,
  ) {}

  @OnEvent('message.created')
  async handleMessageCreated(payload: MessageCreatedEvent) {
    const mentioned = (payload.mentionedUserIds ?? []).filter((id) => id !== payload.senderId);
    if (mentioned.length === 0) return;

    await Promise.all(
      mentioned.map((userId) =>
        this.notifications.create({
          userId,
          type: 'chat.mention',
          actorId: payload.senderId,
          conversationId: payload.conversationId,
          entityType: 'message',
          entityId: payload.id,
          title: payload.senderName,
          body: `${payload.senderName} đã nhắc đến bạn.`,
          metadata: { link: conversationLink(payload.conversationId) },
        }),
      ),
    );
  }

  @OnEvent('friends.request.received')
  async handleFriendRequestReceived(payload: FriendRequestReceivedEvent) {
    const sender = await this.resolveUser(payload.senderId);
    if (!sender) return;

    await this.notifications.create({
      userId: payload.receiverId,
      type: 'friend.request',
      actorId: payload.senderId,
      entityType: 'friendship',
      entityId: payload.senderId,
      title: 'Lời mời kết bạn',
      body: `${sender.name} đã gửi cho bạn lời mời kết bạn.`,
      metadata: { link: FRIENDS_LINK },
    });
  }

  @OnEvent('friends.request.accepted')
  async handleFriendRequestAccepted(payload: FriendRequestAcceptedEvent) {
    const actor = await this.resolveUser(payload.receiverId);
    if (!actor) return;

    await this.notifications.create({
      userId: payload.requesterId,
      type: 'friend.accept',
      actorId: payload.receiverId,
      entityType: 'friendship',
      entityId: payload.receiverId,
      title: 'Kết bạn thành công',
      body: `${actor.name} đã chấp nhận lời mời kết bạn.`,
      metadata: { link: FRIENDS_LINK },
    });
  }

  @OnEvent('friends.request.cancelled')
  async handleFriendRequestCancelled(payload: FriendRequestCancelledEvent) {
    // Rút lại lời mời → gỡ thông báo "friend.request" tương ứng để feed sạch.
    await this.notifications.removeByActor(payload.receiverId, 'friend.request', payload.senderId);
  }

  @OnEvent('conversation.members.added')
  async handleConversationMembersAdded(payload: ConversationMembersAddedEvent) {
    if (payload.addedUserIds.length === 0) return;
    const actor = await this.resolveUser(payload.actorId);
    const actorName = actor?.name ?? 'Một thành viên';
    const groupName = payload.groupName?.trim() || 'nhóm mới';

    await Promise.all(
      payload.addedUserIds.map((userId) =>
        this.notifications.create({
          userId,
          type: 'group.added',
          actorId: payload.actorId,
          conversationId: payload.conversationId,
          entityType: 'conversation',
          entityId: payload.conversationId,
          title: groupName,
          body: `${actorName} đã thêm bạn vào ${groupName}.`,
          metadata: { link: conversationLink(payload.conversationId), groupName },
        }),
      ),
    );
  }

  @OnEvent('conversation.member.kicked')
  async handleConversationMemberKicked(payload: ConversationMemberKickedEvent) {
    const actor = await this.resolveUser(payload.actorId);
    const actorName = actor?.name ?? 'Quản trị viên';
    const groupName = payload.groupName?.trim() || 'nhóm';

    await this.notifications.create({
      userId: payload.targetUserId,
      type: 'group.removed',
      actorId: payload.actorId,
      conversationId: payload.conversationId,
      entityType: 'conversation',
      entityId: payload.conversationId,
      title: groupName,
      body: `${actorName} đã xoá bạn khỏi ${groupName}.`,
      metadata: { link: '/', groupName },
    });
  }

  @OnEvent('call.ended')
  async handleCallEnded(payload: CallEndedEvent) {
    const { state } = payload;
    const caller = state.startedBy;
    const name = caller.displayName || caller.username;
    const kindLabel = state.kind === 'video' ? 'video' : 'thoại';

    // Người không bắt máy (status 'missed'), trừ chính người gọi.
    const missedUserIds = state.participants
      .filter((participant) => participant.status === 'missed' && participant.userId !== caller.id)
      .map((participant) => participant.userId);

    await Promise.all(
      missedUserIds.map((userId) =>
        this.notifications.create({
          userId,
          type: 'call.missed',
          actorId: caller.id,
          conversationId: payload.conversationId,
          entityType: 'call',
          entityId: payload.callId,
          title: name,
          body: `Bạn đã bỏ lỡ cuộc gọi ${kindLabel}.`,
          metadata: { link: conversationLink(payload.conversationId), callKind: state.kind },
        }),
      ),
    );
  }

  private async resolveUser(userId: number) {
    try {
      const summary = await this.profilesService.getPublicSummary(userId);
      return { name: summary.displayName || summary.username, avatar: summary.avatar ?? undefined };
    } catch {
      return null;
    }
  }
}
