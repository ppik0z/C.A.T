import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FcmPushProvider } from './fcm-push.provider';
import { PushSubscriptionsService, type ActiveFcmSubscription } from './push-subscriptions.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { PushNotificationData } from './push-notification.types';

interface MessageCreatedEvent {
  id: number;
  conversationId: number;
  previewContent: string;
  senderId: number;
  senderName: string;
  mentionedUserIds?: number[];
  sender?: { avatar?: string | null };
}

interface FriendRequestReceivedEvent {
  senderId: number;
  receiverId: number;
}

interface FriendRequestAcceptedEvent {
  requesterId: number;
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

interface CallMutationEvent {
  callId: number;
  conversationId: number;
  memberIds: number[];
  ringingUserIds: number[];
  ended: boolean;
  state: {
    kind: 'audio' | 'video';
    isGroup: boolean;
    startedBy: { id: number; username: string; displayName: string | null; avatar: string | null };
  };
}

const MAX_PREVIEW_LENGTH = 120;

@Injectable()
export class PushNotificationListener {
  private readonly logger = new Logger(PushNotificationListener.name);

  constructor(
    private readonly subscriptions: PushSubscriptionsService,
    private readonly fcmPushProvider: FcmPushProvider,
    private readonly profilesService: ProfilesService,
  ) {}

  @OnEvent('message.created')
  async handleMessageCreated(payload: MessageCreatedEvent) {
    const userIds = await this.subscriptions.getConversationRecipientIds(payload.conversationId, payload.senderId);
    const mentionedIds = new Set(payload.mentionedUserIds ?? []);

    await this.dispatch(userIds, (subscription) => ({
      type: mentionedIds.has(subscription.userId) ? 'chat.mention' : 'chat.message',
      title: payload.senderName,
      body: subscription.showNotificationPreview
        ? this.toPreview(payload.previewContent)
        : 'Bạn có tin nhắn mới.',
      icon: payload.sender?.avatar ?? undefined,
      tag: `conversation:${payload.conversationId}`,
      link: `/?conversationId=${payload.conversationId}`,
      conversationId: String(payload.conversationId),
      messageId: String(payload.id),
      senderId: String(payload.senderId),
      senderName: payload.senderName,
    }));
  }

  @OnEvent('friends.request.received')
  async handleFriendRequestReceived(payload: FriendRequestReceivedEvent) {
    const sender = await this.resolveUser(payload.senderId);
    if (!sender) return;

    await this.dispatch([payload.receiverId], () => ({
      type: 'friend.request',
      title: 'Lời mời kết bạn',
      body: `${sender.name} đã gửi cho bạn lời mời kết bạn.`,
      icon: sender.avatar,
      tag: `friend-request:${payload.senderId}`,
      link: '/?view=friends',
      senderId: String(payload.senderId),
      senderName: sender.name,
    }));
  }

  @OnEvent('friends.request.accepted')
  async handleFriendRequestAccepted(payload: FriendRequestAcceptedEvent) {
    const actor = await this.resolveUser(payload.receiverId);
    if (!actor) return;

    await this.dispatch([payload.requesterId], () => ({
      type: 'friend.accept',
      title: 'Kết bạn thành công',
      body: `${actor.name} đã chấp nhận lời mời kết bạn.`,
      icon: actor.avatar,
      tag: `friend-accept:${payload.receiverId}`,
      link: '/?view=friends',
      senderId: String(payload.receiverId),
      senderName: actor.name,
    }));
  }

  @OnEvent('conversation.members.added')
  async handleConversationMembersAdded(payload: ConversationMembersAddedEvent) {
    if (payload.addedUserIds.length === 0) return;
    const actor = await this.resolveUser(payload.actorId);
    const actorName = actor?.name ?? 'Một thành viên';
    const groupName = payload.groupName?.trim() || 'nhóm mới';

    await this.dispatch(payload.addedUserIds, () => ({
      type: 'group.added',
      title: groupName,
      body: `${actorName} đã thêm bạn vào ${groupName}.`,
      tag: `group-added:${payload.conversationId}`,
      link: `/?conversationId=${payload.conversationId}`,
      conversationId: String(payload.conversationId),
    }));
  }

  @OnEvent('conversation.member.kicked')
  async handleConversationMemberKicked(payload: ConversationMemberKickedEvent) {
    const actor = await this.resolveUser(payload.actorId);
    const actorName = actor?.name ?? 'Quản trị viên';
    const groupName = payload.groupName?.trim() || 'nhóm';

    await this.dispatch([payload.targetUserId], () => ({
      type: 'group.removed',
      title: groupName,
      body: `${actorName} đã xoá bạn khỏi ${groupName}.`,
      tag: `group-removed:${payload.conversationId}`,
      link: '/',
      conversationId: String(payload.conversationId),
    }));
  }

  @OnEvent('call.started')
  async handleCallStarted(payload: CallMutationEvent) {
    const caller = payload.state.startedBy;
    const name = caller.displayName || caller.username;
    const isVideo = payload.state.kind === 'video';

    await this.dispatch(payload.ringingUserIds, () => ({
      type: 'call.incoming',
      title: name,
      body: isVideo ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến',
      icon: caller.avatar ?? undefined,
      tag: `call:${payload.callId}`,
      // answerCallId để client tự bắt máy khi mở app từ thông báo.
      link: `/?conversationId=${payload.conversationId}&answerCallId=${payload.callId}`,
      conversationId: String(payload.conversationId),
      callId: String(payload.callId),
      callKind: payload.state.kind,
      senderId: String(caller.id),
      senderName: name,
    }));
  }

  @OnEvent('call.ended')
  async handleCallEnded(payload: CallMutationEvent) {
    await this.dismissCallNotification(payload);
  }

  // Decline / leave / hết giờ đổ chuông kết thúc cuộc gọi qua 'call.state_changed'
  // với ended=true (không phải 'call.ended'), nên cần bắt cả sự kiện này.
  @OnEvent('call.state_changed')
  async handleCallStateChanged(payload: CallMutationEvent) {
    if (payload.ended) await this.dismissCallNotification(payload);
  }

  private async dismissCallNotification(payload: CallMutationEvent) {
    // Đóng thông báo cuộc gọi đến đang treo trên thiết bị nền khi cuộc gọi
    // kết thúc / bị huỷ / hết giờ đổ chuông.
    await this.dispatch(payload.memberIds, () => ({
      type: 'call.cancel',
      title: '',
      body: '',
      tag: `call:${payload.callId}`,
      link: '/',
      callId: String(payload.callId),
      conversationId: String(payload.conversationId),
    }));
  }

  private async dispatch(
    userIds: number[],
    build: (subscription: ActiveFcmSubscription) => PushNotificationData,
  ) {
    try {
      if (userIds.length === 0) return;
      const subscriptions = await this.subscriptions.getActiveFcmSubscriptions(userIds);
      if (subscriptions.length === 0) return;

      const result = await this.fcmPushProvider.send(subscriptions.map((subscription) => ({
        token: subscription.token,
        data: this.toFcmData(build(subscription)),
      })));

      await this.subscriptions.revokeTokens(result.invalidTokens);
      if (result.failureCount > 0) {
        this.logger.warn(`FCM completed with ${result.failureCount} failed deliveries.`);
      }
    } catch (error) {
      this.logger.error('Không thể gửi push notification.', error instanceof Error ? error.stack : String(error));
    }
  }

  private async resolveUser(userId: number) {
    try {
      const summary = await this.profilesService.getPublicSummary(userId);
      return {
        name: summary.displayName || summary.username,
        avatar: summary.avatar ?? undefined,
      };
    } catch {
      return null;
    }
  }

  /** FCM data chỉ nhận string; loại bỏ field rỗng/undefined để payload gọn và hợp lệ. */
  private toFcmData(data: PushNotificationData): Record<string, string> {
    return Object.fromEntries(
      Object.entries(data).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0,
      ),
    );
  }

  private toPreview(content: string) {
    const normalized = content.trim() || 'Bạn có tin nhắn mới.';
    return normalized.length <= MAX_PREVIEW_LENGTH
      ? normalized
      : `${normalized.slice(0, MAX_PREVIEW_LENGTH - 1)}…`;
  }
}
