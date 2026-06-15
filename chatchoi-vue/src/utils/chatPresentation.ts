import type { ChatMessage, ChatUser, Conversation, MentionSummary } from '../types/chat';

export interface MentionSegment {
  type: 'text' | 'mention';
  text: string;
  userId?: number;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Tách nội dung tin nhắn thành các đoạn text thường và chip "@mention",
 * khớp đúng theo ranh giới ký tự dựa trên danh sách username đã được nhắc đến.
 */
export const EVERYONE_MENTION_KEYWORDS = ['everyone', 'all'];

export const buildMentionSegments = (
  content: string,
  mentions: MentionSummary[] | undefined,
  options: { includeEveryone?: boolean } = {},
): MentionSegment[] => {
  if (!content) return [];
  const validMentions = (mentions ?? []).filter((mention) => mention.username);
  const keywords = options.includeEveryone ? EVERYONE_MENTION_KEYWORDS : [];
  if (validMentions.length === 0 && keywords.length === 0) {
    return [{ type: 'text', text: content }];
  }

  const usernameToUserId = new Map(validMentions.map((mention) => [mention.username.toLowerCase(), mention.userId]));
  // Sắp xếp dài trước để tránh khớp nhầm tiền tố (@an vs @another).
  const alternatives = [...validMentions.map((mention) => mention.username), ...keywords]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const pattern = new RegExp(`(^|[^\\w.])@(${alternatives.join('|')})(?![\\w.])`, 'gi');

  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const boundary = match[1];
    const username = match[2];
    const mentionStart = match.index + boundary.length;
    if (mentionStart > lastIndex) {
      segments.push({ type: 'text', text: content.slice(lastIndex, mentionStart) });
    }
    segments.push({ type: 'mention', text: `@${username}`, userId: usernameToUserId.get(username.toLowerCase()) });
    lastIndex = mentionStart + 1 + username.length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return segments;
};

export const getConversationName = (conversation: Conversation | null): string => {
  if (!conversation) return 'Chọn một đoạn chat';

  return conversation.isGroup
    ? conversation.name ?? `Nhóm #${conversation.id}`
    : (conversation.friend?.displayName || conversation.friend?.username) ?? `Chat #${conversation.id}`;
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
