import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';
import { ProfilesService } from '../profiles/profiles.service';

describe('NotificationsListener', () => {
  const notifications = {
    create: jest.fn(),
    removeByActor: jest.fn(),
  };
  const profilesService = {
    getPublicSummary: jest.fn(),
  };
  const listener = new NotificationsListener(
    notifications as unknown as NotificationsService,
    profilesService as unknown as ProfilesService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    profilesService.getPublicSummary.mockResolvedValue({
      id: 7,
      username: 'an_nguyen',
      displayName: 'An',
      avatar: 'https://cdn/a.png',
    });
  });

  it('creates a mention notification for each mentioned user except the sender', async () => {
    await listener.handleMessageCreated({
      id: 21,
      conversationId: 9,
      senderId: 7,
      senderName: 'An',
      mentionedUserIds: [7, 8, 10],
    });

    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 8, type: 'chat.mention', actorId: 7, conversationId: 9, entityId: 21 }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 10, type: 'chat.mention' }),
    );
  });

  it('does nothing when a message has no mentions', async () => {
    await listener.handleMessageCreated({ id: 1, conversationId: 9, senderId: 7, senderName: 'An' });
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('creates a friend.request notification for the receiver', async () => {
    await listener.handleFriendRequestReceived({ senderId: 7, receiverId: 8 });

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 8,
        type: 'friend.request',
        actorId: 7,
        body: 'An đã gửi cho bạn lời mời kết bạn.',
        metadata: { link: '/?view=friends' },
      }),
    );
  });

  it('creates a friend.accept notification for the requester', async () => {
    await listener.handleFriendRequestAccepted({ requesterId: 5, receiverId: 7 });

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 5, type: 'friend.accept', actorId: 7 }),
    );
  });

  it('removes the pending friend.request notification when a request is cancelled', async () => {
    await listener.handleFriendRequestCancelled({ senderId: 7, receiverId: 8 });

    expect(notifications.removeByActor).toHaveBeenCalledWith(8, 'friend.request', 7);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('creates a group.added notification for every added member', async () => {
    await listener.handleConversationMembersAdded({
      conversationId: 9,
      groupName: 'Team Mèo',
      actorId: 7,
      addedUserIds: [8, 10],
    });

    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 8, type: 'group.added', title: 'Team Mèo', conversationId: 9 }),
    );
  });

  it('creates a group.removed notification for the kicked member', async () => {
    await listener.handleConversationMemberKicked({
      conversationId: 9,
      groupName: 'Team Mèo',
      actorId: 7,
      targetUserId: 8,
    });

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 8, type: 'group.removed', conversationId: 9 }),
    );
  });

  it('creates a call.missed notification for ringing participants except the caller', async () => {
    await listener.handleCallEnded({
      callId: 50,
      conversationId: 9,
      state: {
        kind: 'video',
        status: 'missed',
        startedBy: { id: 7, username: 'an_nguyen', displayName: 'An', avatar: 'https://cdn/a.png' },
        participants: [
          { userId: 7, status: 'left' },
          { userId: 8, status: 'missed' },
          { userId: 10, status: 'missed' },
        ],
      },
    });

    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 8, type: 'call.missed', actorId: 7, entityId: 50, conversationId: 9 }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 10, type: 'call.missed' }),
    );
  });
});
