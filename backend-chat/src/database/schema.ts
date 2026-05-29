import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  datetime,
  longtext,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 191 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  avatar: varchar('avatar', { length: 255 }),
  refreshToken: text('refreshToken'),
  createdAt: datetime('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

// ─── Friendships ──────────────────────────────────────────────────────────────
export const friendships = mysqlTable(
  'friendships',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    friendId: int('friendId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    senderId: int('senderId').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    createdAt: datetime('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex('uq_friendship').on(t.userId, t.friendId),
    index('idx_friendship_friend_status').on(t.friendId, t.status),
  ],
);

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversations = mysqlTable('conversations', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }),
  isGroup: boolean('isGroup').notNull().default(false),
  avatarGroup: varchar('avatarGroup', { length: 255 }),
  lastMessageId: int('lastMessageId'),
  lastMessageIndex: int('lastMessageIndex').notNull().default(0),
  lastMessageContent: text('lastMessageContent'),
  lastMessageSenderName: varchar('lastMessageSenderName', { length: 191 }),
  lastMessageType: varchar('lastMessageType', { length: 50 }),
  createdAt: datetime('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

// ─── ConversationMembers ──────────────────────────────────────────────────────
export const conversationMembers = mysqlTable(
  'conversation_members',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    username: varchar('username', { length: 191 }),
    conversationId: int('conversationId').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    nickname: varchar('nickname', { length: 255 }),
    isAdmin: boolean('isAdmin').notNull().default(false),
    lastSeenMessageId: int('lastSeenMessageId'),
    lastSeenMessageIndex: int('lastSeenMessageIndex').notNull().default(0),
    joinedAt: datetime('joinedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex('uq_conv_member').on(t.userId, t.conversationId)],
);

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messages = mysqlTable('messages', {
  id: int('id').autoincrement().primaryKey(),
  content: longtext('content'),
  type: varchar('type', { length: 50 }).notNull().default('text'),
  fileUrl: text('fileUrl'),
  filePublicId: varchar('filePublicId', { length: 255 }),
  fileResourceType: varchar('fileResourceType', { length: 50 }),
  fileName: varchar('fileName', { length: 255 }),
  fileMimeType: varchar('fileMimeType', { length: 191 }),
  fileSizeBytes: int('fileSizeBytes'),
  fileFormat: varchar('fileFormat', { length: 50 }),
  fileWidth: int('fileWidth'),
  fileHeight: int('fileHeight'),
  senderId: int('senderId').notNull().references(() => users.id),
  conversationId: int('conversationId').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  conversationIndex: int('conversationIndex').notNull().default(1),
  createdAt: datetime('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ─── MessageStatuses ──────────────────────────────────────────────────────────
export const messageStatuses = mysqlTable(
  'message_statuses',
  {
    id: int('id').autoincrement().primaryKey(),
    messageId: int('messageId').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    userId: int('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull().default('sent'),
    updatedAt: datetime('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex('uq_msg_status').on(t.messageId, t.userId)],
);

// ─── MessageReactions ─────────────────────────────────────────────────────────
export const messageReactions = mysqlTable(
  'message_reactions',
  {
    id: int('id').autoincrement().primaryKey(),
    messageId: int('messageId').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    userId: int('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    emoji: varchar('emoji', { length: 50 }).notNull(),
    createdAt: datetime('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex('uq_msg_reaction').on(t.messageId, t.userId, t.emoji)],
);

// ─── CallSessions ─────────────────────────────────────────────────────────────
export const callSessions = mysqlTable(
  'call_sessions',
  {
    id: int('id').autoincrement().primaryKey(),
    conversationId: int('conversationId').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    startedByUserId: int('startedByUserId').notNull().references(() => users.id),
    kind: varchar('kind', { length: 20 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('ringing'),
    provider: varchar('provider', { length: 50 }).notNull().default('livekit'),
    roomName: varchar('roomName', { length: 191 }).notNull(),
    startedAt: datetime('startedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    answeredAt: datetime('answeredAt'),
    endedAt: datetime('endedAt'),
    endedReason: varchar('endedReason', { length: 100 }),
  },
  (t) => [
    index('idx_call_sessions_conversation_status').on(t.conversationId, t.status),
    uniqueIndex('uq_call_sessions_room_name').on(t.roomName),
  ],
);

// ─── CallParticipants ─────────────────────────────────────────────────────────
export const callParticipants = mysqlTable(
  'call_participants',
  {
    id: int('id').autoincrement().primaryKey(),
    callSessionId: int('callSessionId').notNull().references(() => callSessions.id, { onDelete: 'cascade' }),
    userId: int('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 30 }).notNull().default('ringing'),
    micEnabled: boolean('micEnabled').notNull().default(false),
    cameraEnabled: boolean('cameraEnabled').notNull().default(false),
    joinedAt: datetime('joinedAt'),
    leftAt: datetime('leftAt'),
    declinedAt: datetime('declinedAt'),
    lastHeartbeatAt: datetime('lastHeartbeatAt'),
    mediaStatus: varchar('mediaStatus', { length: 30 }).notNull().default('idle'),
    mediaConnectedAt: datetime('mediaConnectedAt'),
    mediaDisconnectedAt: datetime('mediaDisconnectedAt'),
    mediaFailureReason: varchar('mediaFailureReason', { length: 191 }),
  },
  (t) => [
    uniqueIndex('uq_call_participants_session_user').on(t.callSessionId, t.userId),
    index('idx_call_participants_user_status').on(t.userId, t.status),
  ],
);

// ─── Relations ────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  sentMessages: many(messages),
  memberships: many(conversationMembers),
  messageStatuses: many(messageStatuses),
  reactions: many(messageReactions),
  friends: many(friendships, { relationName: 'UserFriends' }),
  friendOf: many(friendships, { relationName: 'FriendOfUser' }),
  startedCalls: many(callSessions),
  callParticipations: many(callParticipants),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  user: one(users, { fields: [friendships.userId], references: [users.id], relationName: 'UserFriends' }),
  friend: one(users, { fields: [friendships.friendId], references: [users.id], relationName: 'FriendOfUser' }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  members: many(conversationMembers),
  messages: many(messages),
  callSessions: many(callSessions),
}));

export const conversationMembersRelations = relations(conversationMembers, ({ one }) => ({
  user: one(users, { fields: [conversationMembers.userId], references: [users.id] }),
  conversation: one(conversations, { fields: [conversationMembers.conversationId], references: [conversations.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  statuses: many(messageStatuses),
  reactions: many(messageReactions),
}));

export const messageStatusesRelations = relations(messageStatuses, ({ one }) => ({
  message: one(messages, { fields: [messageStatuses.messageId], references: [messages.id] }),
  user: one(users, { fields: [messageStatuses.userId], references: [users.id] }),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, { fields: [messageReactions.messageId], references: [messages.id] }),
  user: one(users, { fields: [messageReactions.userId], references: [users.id] }),
}));

export const callSessionsRelations = relations(callSessions, ({ one, many }) => ({
  conversation: one(conversations, { fields: [callSessions.conversationId], references: [conversations.id] }),
  startedBy: one(users, { fields: [callSessions.startedByUserId], references: [users.id] }),
  participants: many(callParticipants),
}));

export const callParticipantsRelations = relations(callParticipants, ({ one }) => ({
  callSession: one(callSessions, { fields: [callParticipants.callSessionId], references: [callSessions.id] }),
  user: one(users, { fields: [callParticipants.userId], references: [users.id] }),
}));
