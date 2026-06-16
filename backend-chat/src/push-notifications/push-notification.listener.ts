import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FcmPushProvider } from './fcm-push.provider';
import { PushSubscriptionsService, type ActiveFcmSubscription } from './push-subscriptions.service';
import { ProfilesService } from '../profiles/profiles.service';
import { signCallDeclineToken } from '../calls/call-decline-token';
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

interface CallStartedEvent {
  callId: number;
  conversationId: number;
  ringingUserIds: number[];
  state: {
    kind: 'audio' | 'video';
    startedBy: { id: number; username: string; displayName: string | null; avatar: string | null };
  };
}

interface DispatchOptions {
  /** Tôn trọng trạng thái DND của người nhận (mặc định true; cuộc gọi đặt false). */
  respectUserStatus?: boolean;
  /** Áp dụng cài đặt notificationSound để tắt âm (mặc định true; cuộc gọi đặt false). */
  applySilent?: boolean;
}

const MAX_PREVIEW_LENGTH = 120;
const CALL_DISPATCH_OPTIONS: DispatchOptions = { respectUserStatus: false, applySilent: false };

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
    const recipients = await this.subscriptions.getConversationRecipients(payload.conversationId, payload.senderId);
    const mentionedIds = new Set(payload.mentionedUserIds ?? []);

    // Đã tắt thông báo phòng này thì bỏ qua, TRỪ khi bị mention (@user hoặc @everyone).
    const userIds = recipients
      .filter((recipient) => mentionedIds.has(recipient.userId) || !recipient.muted)
      .map((recipient) => recipient.userId);

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
  async handleCallStarted(payload: CallStartedEvent) {
    const caller = payload.state.startedBy;
    const name = caller.displayName || caller.username;
    const isVideo = payload.state.kind === 'video';

    await this.dispatch(payload.ringingUserIds, (subscription) => ({
      type: 'call.incoming',
      title: name,
      body: isVideo ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến',
      icon: caller.avatar ?? undefined,
      tag: `call:${payload.callId}`,
      // Bấm vào thông báo chỉ mở app; người dùng tự bắt máy ở pop up trong app.
      link: `/?conversationId=${payload.conversationId}`,
      conversationId: String(payload.conversationId),
      callId: String(payload.callId),
      callKind: payload.state.kind,
      // Token để service worker từ chối cuộc gọi này khi app đã đóng.
      declineToken: signCallDeclineToken(payload.callId, subscription.userId),
      senderId: String(caller.id),
      senderName: name,
    }), CALL_DISPATCH_OPTIONS);
  }

  private async dispatch(
    userIds: number[],
    build: (subscription: ActiveFcmSubscription) => PushNotificationData,
    options: DispatchOptions = {},
  ) {
    const { respectUserStatus = true, applySilent = true } = options;
    try {
      if (userIds.length === 0) return;
      let subscriptions = await this.subscriptions.getActiveFcmSubscriptions(userIds);
      // Tôn trọng "Không làm phiền" (trừ cuộc gọi luôn đổ chuông).
      if (respectUserStatus) {
        subscriptions = subscriptions.filter((subscription) => subscription.status !== 'dnd');
      }
      if (subscriptions.length === 0) return;

      const result = await this.fcmPushProvider.send(subscriptions.map((subscription) => {
        const data = build(subscription);
        // Tắt âm theo cài đặt notificationSound (cuộc gọi bỏ qua quy tắc này).
        if (applySilent && !subscription.notificationSound) data.silent = '1';
        return { token: subscription.token, data: this.toFcmData(data) };
      }));

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
