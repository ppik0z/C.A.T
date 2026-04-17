import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  datetime,
  longtext,
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
  (t) => [uniqueIndex('uq_friendship').on(t.userId, t.friendId)],
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
  fileUrl: varchar('fileUrl', { length: 255 }),
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

// ─── Relations ────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  sentMessages: many(messages),
  memberships: many(conversationMembers),
  messageStatuses: many(messageStatuses),
  reactions: many(messageReactions),
  friends: many(friendships, { relationName: 'UserFriends' }),
  friendOf: many(friendships, { relationName: 'FriendOfUser' }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  user: one(users, { fields: [friendships.userId], references: [users.id], relationName: 'UserFriends' }),
  friend: one(users, { fields: [friendships.friendId], references: [users.id], relationName: 'FriendOfUser' }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  members: many(conversationMembers),
  messages: many(messages),
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