import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FcmPushProvider } from './fcm-push.provider';
import { PushSubscriptionsService } from './push-subscriptions.service';

interface MessageCreatedEvent {
  id: number;
  conversationId: number;
  previewContent: string;
  senderId: number;
  senderName: string;
  mentionedUserIds?: number[];
}

const MAX_PREVIEW_LENGTH = 120;

@Injectable()
export class PushNotificationListener {
  private readonly logger = new Logger(PushNotificationListener.name);

  constructor(
    private readonly subscriptions: PushSubscriptionsService,
    private readonly fcmPushProvider: FcmPushProvider,
  ) {}

  @OnEvent('message.created')
  async handleMessageCreated(payload: MessageCreatedEvent) {
    try {
      const members = await this.getRecipientSubscriptions(payload);
      if (members.length === 0) return;

      const mentionedIds = new Set(payload.mentionedUserIds ?? []);
      const result = await this.fcmPushProvider.send(members.map((subscription) => ({
        token: subscription.token,
        data: {
          type: mentionedIds.has(subscription.userId) ? 'chat.mention' : 'chat.message',
          messageId: String(payload.id),
          conversationId: String(payload.conversationId),
          senderName: payload.senderName,
          body: subscription.showNotificationPreview
            ? this.toPreview(payload.previewContent)
            : 'Bạn có tin nhắn mới.',
          link: `/?conversationId=${payload.conversationId}`,
        },
      })));

      await this.subscriptions.revokeTokens(result.invalidTokens);
      if (result.failureCount > 0) {
        this.logger.warn(`FCM completed with ${result.failureCount} failed deliveries.`);
      }
    } catch (error) {
      this.logger.error('Không thể gửi push notification.', error instanceof Error ? error.stack : String(error));
    }
  }

  private async getRecipientSubscriptions(payload: MessageCreatedEvent) {
    const userIds = await this.subscriptions.getConversationRecipientIds(payload.conversationId, payload.senderId);
    return this.subscriptions.getActiveFcmSubscriptions(userIds);
  }

  private toPreview(content: string) {
    const normalized = content.trim() || 'Bạn có tin nhắn mới.';
    return normalized.length <= MAX_PREVIEW_LENGTH
      ? normalized
      : `${normalized.slice(0, MAX_PREVIEW_LENGTH - 1)}…`;
  }
}
