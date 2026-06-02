import { FcmPushProvider, type FcmPushMessage, type FcmPushResult } from './fcm-push.provider';
import { PushNotificationListener } from './push-notification.listener';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { Logger } from '@nestjs/common';

describe('PushNotificationListener', () => {
  const subscriptions = {
    getConversationRecipientIds: jest.fn(),
    getActiveFcmSubscriptions: jest.fn(),
    revokeTokens: jest.fn(),
  };
  const fcmPushProvider = {
    send: jest.fn<(messages: FcmPushMessage[]) => Promise<FcmPushResult>>(),
  };
  const listener = new PushNotificationListener(
    subscriptions as unknown as PushSubscriptionsService,
    fcmPushProvider as unknown as FcmPushProvider,
  );
  const message = {
    id: 21,
    conversationId: 9,
    previewContent: 'Xin chào',
    senderId: 7,
    senderName: 'An',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    subscriptions.getConversationRecipientIds.mockResolvedValue([8, 10]);
    subscriptions.getActiveFcmSubscriptions.mockResolvedValue([
      { userId: 8, token: 'visible-token', showNotificationPreview: true },
      { userId: 10, token: 'private-token', showNotificationPreview: false },
    ]);
    fcmPushProvider.send.mockResolvedValue({
      invalidTokens: ['private-token'],
      failureCount: 1,
      successCount: 1,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends recipient-specific previews and revokes invalid tokens', async () => {
    await listener.handleMessageCreated(message);

    expect(subscriptions.getConversationRecipientIds).toHaveBeenCalledWith(9, 7);
    expect(fcmPushProvider.send).toHaveBeenCalledWith([
      {
        token: 'visible-token',
        data: {
          type: 'chat.message',
          body: 'Xin chào',
          conversationId: '9',
          link: '/?conversationId=9',
          messageId: '21',
          senderName: 'An',
        },
      },
      {
        token: 'private-token',
        data: {
          type: 'chat.message',
          body: 'Bạn có tin nhắn mới.',
          conversationId: '9',
          link: '/?conversationId=9',
          messageId: '21',
          senderName: 'An',
        },
      },
    ]);
    expect(subscriptions.revokeTokens).toHaveBeenCalledWith(['private-token']);
  });

  it('skips FCM when no active subscriptions exist', async () => {
    subscriptions.getActiveFcmSubscriptions.mockResolvedValueOnce([]);

    await listener.handleMessageCreated(message);

    expect(fcmPushProvider.send).not.toHaveBeenCalled();
  });

  it('does not reject message handling when FCM fails', async () => {
    fcmPushProvider.send.mockRejectedValueOnce(new Error('FCM unavailable'));

    await expect(listener.handleMessageCreated(message)).resolves.toBeUndefined();
  });
});
