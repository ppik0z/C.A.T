export interface JwtIdentity {
  userId: number;
  username: string;
}

export interface ChatUser {
  id: number;
  username: string;
  avatar: string | null;
}

export interface ConversationMember {
  id: number;
  userId: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  isAdmin: boolean;
  isOnline?: boolean;
  joinedAt: string;
}

export interface ChatMessage {
  id: number;
  clientTempId?: string;
  conversationId?: number;
  conversationIndex?: number;
  content: string;
  createdAt?: string | Date;
  senderId?: number;
  senderName?: string;
  localStatus?: 'sending' | 'sent';
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
  memberCount?: number;
  members?: ConversationMember[];
  myMember?: {
    userId: number;
    isAdmin: boolean;
  };
  myRole?: 'admin' | 'member';
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

export type MessageDeliveryStatus = 'sent' | 'delivered';

export interface MessageStatusSnapshot {
  messageId: number;
  userId: number;
  status: MessageDeliveryStatus;
  updatedAt: string | Date;
}

export interface MemberReadState {
  userId: number;
  username: string | null;
  lastSeenMessageIndex: number;
}

export interface MessageStatusUpdate {
  conversationId: number;
  messageId: number;
  userId: number;
  status: MessageDeliveryStatus;
}

export interface ReadStateUpdate {
  conversationId: number;
  userId: number;
  username: string;
  lastSeenMessageIndex: number;
}

export interface TypingStateUpdate {
  conversationId: number;
  userId: number;
  username: string;
  isTyping: boolean;
}

export interface TypingUser {
  userId: number;
  username: string;
}

export type MessageLoadState = 'idle' | 'loading' | 'loaded' | 'error';
export type ConversationDetailLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface LoadMessagesSuccessPayload {
  conversationId: number;
  messages: ChatMessage[];
  messageStatuses?: MessageStatusSnapshot[];
  memberReadStates?: MemberReadState[];
}
