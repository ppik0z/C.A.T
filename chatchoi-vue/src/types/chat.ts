export interface JwtIdentity {
  userId: number;
  username: string;
  displayName?: string | null;
}

export interface ChatUser {
  id: number;
  username: string;
  displayName?: string | null;
  avatar: string | null;
}

export interface ConversationMember {
  id: number;
  userId: number;
  username: string;
  displayName?: string | null;
  nickname: string | null;
  avatar: string | null;
  isAdmin: boolean;
  isOnline?: boolean;
  joinedAt: string;
}

export type ChatMessageType = 'text' | 'image' | 'video' | 'document' | 'gif' | 'call_event';

export interface ChatMessage {
  id: number;
  clientTempId?: string;
  conversationId?: number;
  conversationIndex?: number;
  type?: ChatMessageType;
  content: string;
  createdAt?: string | Date;
  fileUrl?: string | null;
  filePublicId?: string | null;
  fileResourceType?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSizeBytes?: number | null;
  fileFormat?: string | null;
  fileWidth?: number | null;
  fileHeight?: number | null;
  senderId?: number;
  senderName?: string;
  localStatus?: 'sending' | 'compressing' | 'uploading' | 'sent' | 'failed';
  uploadProgress?: number;
  compressionProgress?: number;
  uploadError?: string;
  originalFileSizeBytes?: number;
  compressedFileSizeBytes?: number;
  canRetry?: boolean;
  sender?: {
    id: number;
    username: string;
    displayName?: string | null;
  };
}

export interface LastMessage {
  id: number | null;
  content: string | null;
  senderName: string | null;
  type?: ChatMessageType | string | null;
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
  lastMessageType?: ChatMessageType | string;
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
  displayName?: string | null;
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
  displayName?: string | null;
  isTyping: boolean;
}

export interface TypingUser {
  userId: number;
  username: string;
  displayName?: string | null;
}

export interface MessagePageInfo {
  startIndex: number | null;
  endIndex: number | null;
  hasOlder: boolean;
  hasNewer: boolean;
  anchorIndex?: number;
}

export type MessageWindowMode = 'latest' | 'search';

export interface MessageSearchResult {
  messageId: number;
  conversationIndex: number;
  content: string;
  type: ChatMessageType;
  senderName: string;
  createdAt: string | Date;
}

export interface MessageSearchState {
  keyword: string;
  results: MessageSearchResult[];
  activeResultIndex: number;
  loading: boolean;
  error: string | null;
}

export type MessageLoadState = 'idle' | 'loading' | 'loaded' | 'error';
export type ConversationDetailLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface LoadMessagesSuccessPayload {
  conversationId: number;
  messages: ChatMessage[];
  messageStatuses?: MessageStatusSnapshot[];
  memberReadStates?: MemberReadState[];
  pageInfo?: MessagePageInfo;
}
