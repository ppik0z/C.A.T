import type { ChatUser, Conversation } from '../types/chat';

export const getConversationName = (conversation: Conversation | null): string => {
  if (!conversation) return 'Chọn một đoạn chat';

  return conversation.isGroup
    ? conversation.name ?? `Nhóm #${conversation.id}`
    : conversation.friend?.username ?? `Chat #${conversation.id}`;
};

export const getConversationInitials = (conversation: Conversation | null): string => {
  return getConversationName(conversation)
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

export const getUserInitials = (name: string): string => {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

export const getConversationUser = (conversation: Conversation | null): ChatUser | null => {
  if (!conversation || conversation.isGroup) return null;
  return conversation.friend;
};

export const getLastMessagePreview = (conversation: Conversation, currentUsername: string | null): string => {
  if (conversation.lastMessage?.content) {
    const sender = conversation.lastMessage.senderName === currentUsername ? 'Bạn' : conversation.lastMessage.senderName;
    return sender ? `${sender}: ${conversation.lastMessage.content}` : conversation.lastMessage.content;
  }

  return conversation.lastMessageContent ?? 'Chưa có tin nhắn nào...';
};

export const getConversationKindLabel = (conversation: Conversation | null): string => {
  if (!conversation) return 'Conversation';
  return conversation.isGroup ? 'Group chat' : 'Direct message';
};
