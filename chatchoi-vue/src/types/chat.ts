export interface JwtIdentity {
  userId: number;
  username: string;
}

export interface ChatUser {
  id: number;
  username: string;
  avatar: string | null;
}

export interface ChatMessage {
  id: number;
  conversationId?: number;
  conversationIndex?: number;
  content: string;
  senderId?: number;
  senderName?: string;
  sender?: {
    id: number;
    username: string;
  };
}

export interface LastMessage {
  id: number | null;
  content: string | null;
  senderName: string | null;
}

export interface Conversation {
  id: number;
  name: string | null;
  isGroup: boolean;
  avatarGroup: string | null;
  unreadCount: number;
  isOnline?: boolean;
  lastMessageIndex?: number;
  lastSeenMessageIndex?: number;
  lastMessageContent?: string | null;
  friend: ChatUser | null;
  lastMessage: LastMessage;
}

export interface ConversationListUpdate {
  conversationId: number;
  lastMessageContent: string;
  senderName: string;
  lastMessageId: number;
  lastMessageIndex: number;
}

export type MessageLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface LoadMessagesSuccessPayload {
  conversationId: number;
  messages: ChatMessage[];
}
