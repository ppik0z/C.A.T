import { FcmPushProvider, type FcmPushMessage, type FcmPushResult } from './fcm-push.provider';
import { PushNotificationListener } from './push-notification.listener';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { ProfilesService } from '../profiles/profiles.service';
import { Logger } from '@nestjs/common';

describe('PushNotificationListener', () => {
  const subscriptions = {
    getConversationRecipients: jest.fn(),
    getActiveFcmSubscriptions: jest.fn(),
    revokeTokens: jest.fn(),
  };
  const fcmPushProvider = {
    send: jest.fn<(messages: FcmPushMessage[]) => Promise<FcmPushResult>>(),
  };
  const profilesService = {
    getPublicSummary: jest.fn(),
  };
  const listener = new PushNotificationListener(
    subscriptions as unknown as PushSubscriptionsService,
    fcmPushProvider as unknown as FcmPushProvider,
    profilesService as unknown as ProfilesService,
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
    subscriptions.getConversationRecipients.mockResolvedValue([
      { userId: 8, muted: false },
      { userId: 10, muted: false },
    ]);
    subscriptions.getActiveFcmSubscriptions.mockResolvedValue([
      { userId: 8, token: 'visible-token', showNotificationPreview: true, notificationSound: true, status: 'online' },
      { userId: 10, token: 'private-token', showNotificationPreview: false, notificationSound: true, status: 'online' },
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

    expect(subscriptions.getConversationRecipients).toHaveBeenCalledWith(9, 7);
    expect(fcmPushProvider.send).toHaveBeenCalledWith([
      {
        token: 'visible-token',
        data: {
          type: 'chat.message',
          title: 'An',
          body: 'Xin chào',
          tag: 'conversation:9',
          link: '/?conversationId=9',
          conversationId: '9',
          messageId: '21',
          senderId: '7',
          senderName: 'An',
        },
      },
      {
        token: 'private-token',
        data: {
          type: 'chat.message',
          title: 'An',
          body: 'Bạn có tin nhắn mới.',
          tag: 'conversation:9',
          link: '/?conversationId=9',
          conversationId: '9',
          messageId: '21',
          senderId: '7',
          senderName: 'An',
        },
      },
    ]);
    expect(subscriptions.revokeTokens).toHaveBeenCalledWith(['private-token']);
  });

  it('skips muted recipients but still notifies muted users who are mentioned', async () => {
    subscriptions.getConversationRecipients.mockResolvedValue([
      { userId: 8, muted: true },
      { userId: 10, muted: true },
    ]);
    subscriptions.getActiveFcmSubscriptions.mockResolvedValue([
      { userId: 10, token: 'mentioned-token', showNotificationPreview: true, notificationSound: true, status: 'online' },
    ]);

    await listener.handleMessageCreated({ ...message, mentionedUserIds: [10] });

    expect(subscriptions.getActiveFcmSubscriptions).toHaveBeenCalledWith([10]);
    expect(fcmPushProvider.send).toHaveBeenCalledWith([
      expect.objectContaining({
        token: 'mentioned-token',
        data: expect.objectContaining({ type: 'chat.mention' }),
      }),
    ]);
  });

  it('marks the notification silent when the recipient disabled sound', async () => {
    subscriptions.getConversationRecipients.mockResolvedValue([{ userId: 8, muted: false }]);
    subscriptions.getActiveFcmSubscriptions.mockResolvedValue([
      { userId: 8, token: 'silent-token', showNotificationPreview: true, notificationSound: false, status: 'online' },
    ]);

    await listener.handleMessageCreated(message);

    expect(fcmPushProvider.send).toHaveBeenCalledWith([
      expect.objectContaining({ data: expect.objectContaining({ silent: '1' }) }),
    ]);
  });

  it('does not push chat messages to recipients in do-not-disturb', async () => {
    subscriptions.getConversationRecipients.mockResolvedValue([{ userId: 8, muted: false }]);
    subscriptions.getActiveFcmSubscriptions.mockResolvedValue([
      { userId: 8, token: 'dnd-token', showNotificationPreview: true, notificationSound: true, status: 'dnd' },
    ]);

    await listener.handleMessageCreated(message);

    expect(fcmPushProvider.send).not.toHaveBeenCalled();
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

  it('sends a friend request push to the receiver only', async () => {
    profilesService.getPublicSummary.mockResolvedValue({
      id: 7,
      username: 'an_nguyen',
      displayName: 'An',
      avatar: 'https://cdn/avatar.png',
    });
    subscriptions.getActiveFcmSubscriptions.mockResolvedValue([
      { userId: 8, token: 'receiver-token', showNotificationPreview: true, notificationSound: true, status: 'online' },
    ]);

    await listener.handleFriendRequestReceived({ senderId: 7, receiverId: 8 });

    expect(subscriptions.getActiveFcmSubscriptions).toHaveBeenCalledWith([8]);
    expect(fcmPushProvider.send).toHaveBeenCalledWith([
      {
        token: 'receiver-token',
        data: {
          type: 'friend.request',
          title: 'Lời mời kết bạn',
          body: 'An đã gửi cho bạn lời mời kết bạn.',
          icon: 'https://cdn/avatar.png',
          tag: 'friend-request:7',
          link: '/?view=friends',
          senderId: '7',
          senderName: 'An',
        },
      },
    ]);
  });

  it('notifies every member added to a group', async () => {
    profilesService.getPublicSummary.mockResolvedValue({
      id: 7,
      username: 'an_nguyen',
      displayName: 'An',
      avatar: null,
    });
    subscriptions.getActiveFcmSubscriptions.mockResolvedValue([
      { userId: 8, token: 'added-token', showNotificationPreview: true, notificationSound: true, status: 'online' },
    ]);

    await listener.handleConversationMembersAdded({
      conversationId: 9,
      groupName: 'Team Mèo',
      actorId: 7,
      addedUserIds: [8],
    });

    expect(subscriptions.getActiveFcmSubscriptions).toHaveBeenCalledWith([8]);
    expect(fcmPushProvider.send).toHaveBeenCalledWith([
      {
        token: 'added-token',
        data: {
          type: 'group.added',
          title: 'Team Mèo',
          body: 'An đã thêm bạn vào Team Mèo.',
          tag: 'group-added:9',
          link: '/?conversationId=9',
          conversationId: '9',
        },
      },
    ]);
  });

  it('pushes an incoming-call notification to ringing users only', async () => {
    subscriptions.getActiveFcmSubscriptions.mockResolvedValue([
      { userId: 8, token: 'callee-token', showNotificationPreview: true },
    ]);

    await listener.handleCallStarted({
      callId: 50,
      conversationId: 9,
      ringingUserIds: [8],
      state: {
        kind: 'video',
        startedBy: { id: 7, username: 'an_nguyen', displayName: 'An', avatar: 'https://cdn/a.png' },
      },
    });

    expect(subscriptions.getActiveFcmSubscriptions).toHaveBeenCalledWith([8]);
    expect(fcmPushProvider.send).toHaveBeenCalledWith([
      {
        token: 'callee-token',
        data: expect.objectContaining({
          type: 'call.incoming',
          title: 'An',
          body: 'Cuộc gọi video đến',
          icon: 'https://cdn/a.png',
          tag: 'call:50',
          link: '/?conversationId=9',
          conversationId: '9',
          callId: '50',
          callKind: 'video',
          declineToken: expect.any(String),
          senderId: '7',
          senderName: 'An',
        }),
      },
    ]);
  });
});
