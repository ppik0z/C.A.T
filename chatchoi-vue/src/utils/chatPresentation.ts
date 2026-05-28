import type { ChatMessage, ChatUser, Conversation } from '../types/chat';

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
    if (conversation.lastMessage.type === 'call_event') return conversation.lastMessage.content;

    const sender = conversation.lastMessage.senderName === currentUsername ? 'Bạn' : conversation.lastMessage.senderName;
    return sender ? `${sender}: ${conversation.lastMessage.content}` : conversation.lastMessage.content;
  }

  return conversation.lastMessageContent ?? 'Chưa có tin nhắn nào...';
};

export const getConversationKindLabel = (conversation: Conversation | null): string => {
  if (!conversation) return 'Conversation';
  return conversation.isGroup ? 'Group chat' : 'Direct message';
};

const toDate = (value: string | Date | undefined): Date => {
  return value ? new Date(value) : new Date();
};

const startOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const getMessageDateKey = (message: ChatMessage): string => {
  return startOfDay(toDate(message.createdAt)).toISOString();
};

export const formatMessageDateDivider = (value: string | Date | undefined): string => {
  const date = startOfDay(toDate(value));
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Hôm nay';
  if (date.getTime() === yesterday.getTime()) return 'Hôm qua';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const formatMessageTime = (value: string | Date | undefined): string => {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(toDate(value));
};

export const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes || bytes <= 0) return '';

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
};
