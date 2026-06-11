import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, gt, gte, inArray, isNull, like, lt } from 'drizzle-orm';
import {
    callParticipants,
    callSessions,
    conversationMembers,
    conversations,
    messageReactions,
    messages,
    messageStatuses,
    users,
} from '../database/schema';
import { DrizzleService } from '../database/drizzle.service';
import { ProfilesService, type PublicUserSummaryDto } from '../profiles/profiles.service';
import { MediaUploadService, type ChatMessageType, type UploadedMedia } from './media-upload.service';

export type MessageDeliveryStatus = 'sent' | 'delivered';
export type MessageType = 'text' | 'gif' | 'call_event' | ChatMessageType;

export interface SendMessageInput {
    type?: 'text' | 'gif';
    content?: string;
    fileUrl?: string;
    clientTempId?: string;
    clientMessageId?: string;
    replyToMessageId?: number;
    mentionedUserIds?: number[];
}

export interface CreateMediaMessageInput {
    conversationId: number;
    caption?: string;
    clientTempId?: string;
    clientMessageId?: string;
    replyToMessageId?: number;
    mentionedUserIds?: number[];
    media: UploadedMedia;
}

export interface CreateCallEventMessageInput {
    conversationId: number;
    senderId: number;
    callSessionId: number;
    content: string;
}

export interface MessageStatusSnapshot {
    messageId: number;
    userId: number;
    status: MessageDeliveryStatus;
    updatedAt: Date;
}

export interface MessageReactionSummary {
    emoji: string;
    count: number;
    reactedByMe: boolean;
}

export interface ReplySnapshot {
    id: number;
    senderName: string;
    type: string;
    contentPreview: string;
    recalled: boolean;
}

export type CallEventSessionStatus = 'ended' | 'missed' | 'cancelled';
export type CallEventParticipantStatus = 'ringing' | 'joined' | 'left' | 'declined' | 'missed';

export interface CallEventParticipantSnapshot {
    userId: number;
    status: CallEventParticipantStatus;
}

export interface CallEventSnapshot {
    callId: number;
    kind: 'audio' | 'video';
    status: CallEventSessionStatus;
    endedReason: string | null;
    startedAt: Date;
    answeredAt: Date | null;
    endedAt: Date | null;
    durationSeconds: number;
    startedByUserId: number;
    currentUserStatus: CallEventParticipantStatus | 'none';
    participants: CallEventParticipantSnapshot[];
}

export interface SerializedMessage {
    id: number;
    clientTempId?: string;
    clientMessageId?: string | null;
    content: string;
    type: string;
    fileUrl: string | null;
    filePublicId: string | null;
    fileResourceType: string | null;
    fileName: string | null;
    fileMimeType: string | null;
    fileSizeBytes: number | null;
    fileFormat: string | null;
    fileWidth: number | null;
    fileHeight: number | null;
    fileThumbnailUrl: string | null;
    fileDurationSeconds: number | null;
    callSessionId: number | null;
    callEvent: CallEventSnapshot | null;
    conversationId: number;
    senderId: number;
    senderName: string;
    sender: PublicUserSummaryDto;
    conversationIndex: number;
    createdAt: Date;
    recalledAt: Date | null;
    recalledByUserId: number | null;
    replyToMessageId: number | null;
    replyTo: ReplySnapshot | null;
    reactions: MessageReactionSummary[];
    previewContent: string;
    mentionedUserIds?: number[];
}

export interface MessagePageInfo {
    startIndex: number | null;
    endIndex: number | null;
    hasOlder: boolean;
    hasNewer: boolean;
    anchorIndex?: number;
}

export interface MessageWindow {
    messages: SerializedMessage[];
    pageInfo: MessagePageInfo;
}

export interface SearchMessageResult {
    messageId: number;
    conversationIndex: number;
    content: string;
    type: string;
    senderName: string;
    createdAt: Date;
}

export interface ReactionDelta {
    conversationId: number;
    messageId: number;
    reactions: MessageReactionSummary[];
}

export interface RecallDelta {
    conversationId: number;
    messageId: number;
    recalledAt: Date;
    recalledByUserId: number;
    lastMessage?: {
        id: number;
        content: string;
        type: string;
    };
}

const DEFAULT_MESSAGE_LIMIT = 40;
const AROUND_BEFORE_LIMIT = 20;
const AROUND_AFTER_LIMIT = 20;
const RECALL_PREVIEW = 'Tin nhắn đã được thu hồi';
const SUPPORTED_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '😡']);
const MAX_MENTIONED_USERS = 50;

type MessageRow = Awaited<ReturnType<MessagesService['findMessages']>>[number];

@Injectable()
export class MessagesService {
    private readonly logger = new Logger(MessagesService.name);

    constructor(
        private drizzle: DrizzleService,
        private eventEmitter: EventEmitter2,
        private profilesService: ProfilesService,
        private mediaUploadService: MediaUploadService,
    ) { }

    async validateMember(userId: number, conversationId: number) {
        const member = await this.drizzle.db
            .select({
                isAdmin: conversationMembers.isAdmin,
            })
            .from(conversationMembers)
            .where(and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, userId),
            ))
            .limit(1);

        if (member.length === 0) {
            throw new ForbiddenException('Bạn không có quyền trong phòng chat!');
        }
        return member[0];
    }

    async getConversationMemberIds(conversationId: number) {
        const members = await this.drizzle.db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, conversationId));

        return members.map((member) => member.userId);
    }

    async sendMessage(
        senderId: number,
        conversationId: number,
        content: string,
        clientTempId?: string,
        input?: SendMessageInput,
    ) {
        await this.validateMember(senderId, conversationId);
        const [messageType, sender, mentionedUserIds] = await Promise.all([
            Promise.resolve(input?.type ?? 'text'),
            this.profilesService.getPublicSummary(senderId),
            this.validateMentionedUsers(conversationId, input?.mentionedUserIds ?? []),
        ]);

        if (messageType === 'gif') {
            const gifUrl = input?.fileUrl?.trim();
            if (!gifUrl || !this.isHttpsUrl(gifUrl)) {
                throw new BadRequestException('GIF URL không hợp lệ.');
            }

            return this.createMessage({
                senderId,
                conversationId,
                sender,
                type: 'gif',
                content: input?.content?.trim() || content?.trim() || '',
                clientTempId: input?.clientTempId ?? clientTempId,
                clientMessageId: input?.clientMessageId ?? input?.clientTempId ?? clientTempId,
                fileUrl: gifUrl,
                replyToMessageId: input?.replyToMessageId,
                mentionedUserIds,
            });
        }

        const textContent = content?.trim();
        if (!textContent) {
            throw new BadRequestException('Nội dung tin nhắn không được để trống.');
        }

        return this.createMessage({
            senderId,
            conversationId,
            sender,
            type: 'text',
            content: textContent,
            clientTempId: input?.clientTempId ?? clientTempId,
            clientMessageId: input?.clientMessageId ?? input?.clientTempId ?? clientTempId,
            replyToMessageId: input?.replyToMessageId,
            mentionedUserIds,
        });
    }

    async createMediaMessage(senderId: number, input: CreateMediaMessageInput) {
        await this.validateMember(senderId, input.conversationId);
        const [sender, mentionedUserIds] = await Promise.all([
            this.profilesService.getPublicSummary(senderId),
            this.validateMentionedUsers(input.conversationId, input.mentionedUserIds ?? []),
        ]);

        return this.createMessage({
            senderId,
            conversationId: input.conversationId,
            sender,
            type: input.media.type,
            content: input.caption?.trim() || '',
            clientTempId: input.clientTempId,
            clientMessageId: input.clientMessageId ?? input.clientTempId,
            fileUrl: input.media.fileUrl,
            filePublicId: input.media.filePublicId,
            fileResourceType: input.media.fileResourceType,
            fileName: input.media.fileName,
            fileMimeType: input.media.fileMimeType,
            fileSizeBytes: input.media.fileSizeBytes,
            fileFormat: input.media.fileFormat,
            fileWidth: input.media.fileWidth,
            fileHeight: input.media.fileHeight,
            fileThumbnailUrl: input.media.fileThumbnailUrl,
            fileDurationSeconds: input.media.fileDurationSeconds,
            replyToMessageId: input.replyToMessageId,
            mentionedUserIds,
        });
    }

    async createCallEventMessage(input: CreateCallEventMessageInput) {
        const sender = await this.profilesService.getPublicSummary(input.senderId);
        return this.createMessage({
            senderId: input.senderId,
            conversationId: input.conversationId,
            sender,
            type: 'call_event',
            content: input.content.trim(),
            callSessionId: input.callSessionId,
        });
    }

    private async createMessage(input: {
        senderId: number;
        conversationId: number;
        sender: PublicUserSummaryDto;
        type: MessageType;
        content: string;
        clientTempId?: string;
        clientMessageId?: string;
        fileUrl?: string;
        filePublicId?: string;
        fileResourceType?: string;
        fileName?: string;
        fileMimeType?: string;
        fileSizeBytes?: number;
        fileFormat?: string | null;
        fileWidth?: number | null;
        fileHeight?: number | null;
        fileThumbnailUrl?: string | null;
        fileDurationSeconds?: number | null;
        callSessionId?: number;
        replyToMessageId?: number;
        mentionedUserIds?: number[];
    }) {
        const clientMessageId = this.normalizeClientMessageId(input.clientMessageId);
        if (clientMessageId) {
            const existing = await this.findExistingClientMessage(input.senderId, clientMessageId);
            if (existing) {
                return this.getSerializedMessage(input.senderId, existing.conversationId, existing.id, {
                    clientTempId: input.clientTempId,
                    mentionedUserIds: input.mentionedUserIds,
                });
            }
        }

        if (input.replyToMessageId) {
            await this.assertReplyTarget(input.conversationId, input.replyToMessageId);
        }

        const previewContent = this.getMessagePreview(input.type, input.content, input.fileName);

        const messageId = await this.drizzle.db.transaction(async (tx) => {
            const [conv] = await tx.select({ currentIdx: conversations.lastMessageIndex })
                .from(conversations)
                .where(eq(conversations.id, input.conversationId))
                .for('update');

            const nextIndex = (conv?.currentIdx || 0) + 1;

            const [newMessage] = await tx.insert(messages).values({
                clientMessageId,
                content: input.content,
                senderId: input.senderId,
                conversationId: input.conversationId,
                type: input.type,
                fileUrl: input.fileUrl ?? null,
                filePublicId: input.filePublicId ?? null,
                fileResourceType: input.fileResourceType ?? null,
                fileName: input.fileName ?? null,
                fileMimeType: input.fileMimeType ?? null,
                fileSizeBytes: input.fileSizeBytes ?? null,
                fileFormat: input.fileFormat ?? null,
                fileWidth: input.fileWidth ?? null,
                fileHeight: input.fileHeight ?? null,
                fileThumbnailUrl: input.fileThumbnailUrl ?? null,
                fileDurationSeconds: input.fileDurationSeconds ?? null,
                callSessionId: input.callSessionId ?? null,
                replyToMessageId: input.replyToMessageId ?? null,
                conversationIndex: nextIndex,
            });

            const memberIds = await tx
                .select({ userId: conversationMembers.userId })
                .from(conversationMembers)
                .where(eq(conversationMembers.conversationId, input.conversationId));

            await tx.insert(messageStatuses).values(memberIds.map((member) => ({
                messageId: newMessage.insertId,
                userId: member.userId,
                status: 'sent',
            })));

            await tx.update(conversations)
                .set({
                    lastMessageId: newMessage.insertId,
                    lastMessageIndex: nextIndex,
                    lastMessageContent: previewContent,
                    lastMessageSenderName: input.sender.displayName || input.sender.username,
                    lastMessageType: input.type,
                    updatedAt: new Date(),
                })
                .where(eq(conversations.id, input.conversationId));

            return newMessage.insertId;
        });

        const savedMessage = await this.getSerializedMessage(input.senderId, input.conversationId, messageId, {
            clientTempId: input.clientTempId,
            mentionedUserIds: input.mentionedUserIds,
        });
        this.eventEmitter.emit('message.created', savedMessage);
        return savedMessage;
    }

    async markMessageDelivered(userId: number, conversationId: number, messageId: number) {
        await this.validateMember(userId, conversationId);

        const [message] = await this.drizzle.db
            .select({
                id: messages.id,
                senderId: messages.senderId,
                conversationId: messages.conversationId,
            })
            .from(messages)
            .where(and(
                eq(messages.id, messageId),
                eq(messages.conversationId, conversationId),
            ))
            .limit(1);

        if (!message || message.senderId === userId) return null;

        await this.drizzle.db
            .insert(messageStatuses)
            .values({
                messageId,
                userId,
                status: 'delivered',
                updatedAt: new Date(),
            })
            .onDuplicateKeyUpdate({
                set: {
                    status: 'delivered',
                    updatedAt: new Date(),
                },
            });

        return {
            conversationId,
            messageId,
            userId,
            status: 'delivered' as const,
        };
    }

    async setReaction(userId: number, input: { conversationId: number; messageId: number; emoji: string }): Promise<ReactionDelta> {
        await this.validateMember(userId, input.conversationId);
        if (!SUPPORTED_REACTIONS.has(input.emoji)) {
            throw new BadRequestException('Reaction không được hỗ trợ.');
        }
        await this.assertReactableMessage(input.conversationId, input.messageId);

        await this.drizzle.db.insert(messageReactions).values({
            messageId: input.messageId,
            userId,
            emoji: input.emoji,
        }).onDuplicateKeyUpdate({
            set: {
                emoji: input.emoji,
                createdAt: new Date(),
            },
        });

        return {
            conversationId: input.conversationId,
            messageId: input.messageId,
            reactions: await this.getReactionSummaries([input.messageId], userId).then((items) => items[input.messageId] ?? []),
        };
    }

    async removeReaction(userId: number, input: { conversationId: number; messageId: number }): Promise<ReactionDelta> {
        await this.validateMember(userId, input.conversationId);
        await this.assertMessageInConversation(input.conversationId, input.messageId);

        await this.drizzle.db.delete(messageReactions).where(and(
            eq(messageReactions.messageId, input.messageId),
            eq(messageReactions.userId, userId),
        ));

        return {
            conversationId: input.conversationId,
            messageId: input.messageId,
            reactions: await this.getReactionSummaries([input.messageId], userId).then((items) => items[input.messageId] ?? []),
        };
    }

    async recallMessage(userId: number, input: { conversationId: number; messageId: number }): Promise<RecallDelta> {
        await this.validateMember(userId, input.conversationId);

        const [message] = await this.drizzle.db
            .select({
                id: messages.id,
                senderId: messages.senderId,
                conversationId: messages.conversationId,
                filePublicId: messages.filePublicId,
                fileResourceType: messages.fileResourceType,
                recalledAt: messages.recalledAt,
            })
            .from(messages)
            .where(and(eq(messages.id, input.messageId), eq(messages.conversationId, input.conversationId)))
            .limit(1);

        if (!message) throw new NotFoundException('Không tìm thấy tin nhắn.');
        if (message.senderId !== userId) throw new ForbiddenException('Bạn chỉ có thể thu hồi tin nhắn của chính mình.');

        const recalledAt = message.recalledAt ?? new Date();
        await this.drizzle.db.transaction(async (tx) => {
            if (!message.recalledAt) {
                await tx.update(messages)
                    .set({
                        recalledAt,
                        recalledByUserId: userId,
                    })
                    .where(eq(messages.id, input.messageId));

                await tx.delete(messageReactions).where(eq(messageReactions.messageId, input.messageId));
            }

            const [conversation] = await tx.select({ lastMessageId: conversations.lastMessageId })
                .from(conversations)
                .where(eq(conversations.id, input.conversationId))
                .limit(1);

            if (conversation?.lastMessageId === input.messageId) {
                await tx.update(conversations)
                    .set({
                        lastMessageContent: RECALL_PREVIEW,
                        lastMessageType: 'text',
                        updatedAt: new Date(),
                    })
                    .where(eq(conversations.id, input.conversationId));
            }
        });

        if (message.filePublicId) {
            void this.cleanupRecalledMedia(input.messageId, message.filePublicId, message.fileResourceType ?? 'image');
        }

        const [conversation] = await this.drizzle.db
            .select({ lastMessageId: conversations.lastMessageId })
            .from(conversations)
            .where(eq(conversations.id, input.conversationId))
            .limit(1);

        return {
            conversationId: input.conversationId,
            messageId: input.messageId,
            recalledAt,
            recalledByUserId: userId,
            lastMessage: conversation?.lastMessageId === input.messageId
                ? { id: input.messageId, content: RECALL_PREVIEW, type: 'text' }
                : undefined,
        };
    }

    async getMessages(userId: number, conversationId: number, limit = DEFAULT_MESSAGE_LIMIT) {
        await this.validateMember(userId, conversationId);

        const results = await this.drizzle.db.query.messages.findMany({
            where: eq(messages.conversationId, conversationId),
            with: {
                sender: {
                    columns: { id: true, username: true, displayName: true, avatar: true },
                },
            },
            orderBy: (messages, { desc }) => [desc(messages.createdAt)],
            limit,
        });

        return this.serializeMessages(results.reverse(), userId);
    }

    async getMessageWindow(
        userId: number,
        input: {
            conversationId: number;
            limit?: number;
            beforeIndex?: number;
            afterIndex?: number;
            anchorIndex?: number;
        },
    ): Promise<MessageWindow> {
        await this.validateMember(userId, input.conversationId);

        const limit = this.normalizeLimit(input.limit);
        if (input.anchorIndex && input.anchorIndex > 0) {
            return this.getMessagesAround(userId, input.conversationId, input.anchorIndex);
        }
        if (input.beforeIndex && input.beforeIndex > 0) {
            return this.getMessagesBefore(userId, input.conversationId, input.beforeIndex, limit);
        }
        if (input.afterIndex && input.afterIndex > 0) {
            return this.getMessagesAfter(userId, input.conversationId, input.afterIndex, limit);
        }

        return this.getLatestMessages(userId, input.conversationId, limit);
    }

    async searchMessages(
        userId: number,
        input: { conversationId: number; keyword: string; limit?: number },
    ): Promise<SearchMessageResult[]> {
        await this.validateMember(userId, input.conversationId);

        const keyword = input.keyword.trim();
        if (keyword.length < 2) return [];

        const limit = this.normalizeSearchLimit(input.limit);
        const results = await this.drizzle.db.query.messages.findMany({
            where: and(
                eq(messages.conversationId, input.conversationId),
                isNull(messages.recalledAt),
                like(messages.content, `%${this.escapeLike(keyword)}%`),
            ),
            with: {
                sender: {
                    columns: { id: true, username: true, displayName: true },
                },
            },
            orderBy: (messages, { desc }) => [desc(messages.conversationIndex)],
            limit,
        });

        return results.map((message) => ({
            messageId: message.id,
            conversationIndex: message.conversationIndex,
            content: message.content ?? '',
            type: message.type,
            senderName: message.sender?.displayName ?? message.sender?.username ?? `User #${message.senderId}`,
            createdAt: message.createdAt,
        }));
    }

    async getMessageStatuses(messageIds: number[]): Promise<MessageStatusSnapshot[]> {
        if (messageIds.length === 0) return [];

        const rows = await this.drizzle.db
            .select({
                messageId: messageStatuses.messageId,
                userId: messageStatuses.userId,
                status: messageStatuses.status,
                updatedAt: messageStatuses.updatedAt,
            })
            .from(messageStatuses)
            .where(inArray(messageStatuses.messageId, messageIds));

        return rows.map((row) => ({
            messageId: row.messageId,
            userId: row.userId,
            status: row.status === 'delivered' ? 'delivered' : 'sent',
            updatedAt: row.updatedAt,
        }));
    }

    private async getLatestMessages(userId: number, conversationId: number, limit: number): Promise<MessageWindow> {
        const rows = await this.findMessages(conversationId, limit + 1, 'latest');
        const hasOlder = rows.length > limit;
        const windowRows = rows.slice(0, limit).reverse();

        return {
            messages: await this.serializeMessages(windowRows, userId),
            pageInfo: this.buildPageInfo(windowRows, hasOlder, false),
        };
    }

    private async getMessagesBefore(userId: number, conversationId: number, beforeIndex: number, limit: number): Promise<MessageWindow> {
        const rows = await this.findMessages(conversationId, limit + 1, 'before', beforeIndex);
        const hasOlder = rows.length > limit;
        const windowRows = rows.slice(0, limit).reverse();

        return {
            messages: await this.serializeMessages(windowRows, userId),
            pageInfo: this.buildPageInfo(windowRows, hasOlder, true),
        };
    }

    private async getMessagesAfter(userId: number, conversationId: number, afterIndex: number, limit: number): Promise<MessageWindow> {
        const rows = await this.findMessages(conversationId, limit + 1, 'after', afterIndex);
        const hasNewer = rows.length > limit;
        const windowRows = rows.slice(0, limit);

        return {
            messages: await this.serializeMessages(windowRows, userId),
            pageInfo: this.buildPageInfo(windowRows, true, hasNewer),
        };
    }

    private async getMessagesAround(userId: number, conversationId: number, anchorIndex: number): Promise<MessageWindow> {
        const beforeRows = await this.findMessages(conversationId, AROUND_BEFORE_LIMIT + 1, 'before', anchorIndex);
        const afterRows = await this.findMessages(conversationId, AROUND_AFTER_LIMIT + 1, 'from', anchorIndex);
        const hasOlder = beforeRows.length > AROUND_BEFORE_LIMIT;
        const hasNewer = afterRows.length > AROUND_AFTER_LIMIT;
        const windowRows = [
            ...beforeRows.slice(0, AROUND_BEFORE_LIMIT).reverse(),
            ...afterRows.slice(0, AROUND_AFTER_LIMIT),
        ];

        return {
            messages: await this.serializeMessages(windowRows, userId),
            pageInfo: {
                ...this.buildPageInfo(windowRows, hasOlder, hasNewer),
                anchorIndex,
            },
        };
    }

    private async findMessages(
        conversationId: number,
        limit: number,
        mode: 'latest' | 'before' | 'after' | 'from',
        index?: number,
    ) {
        const where = mode === 'before' && index
            ? and(eq(messages.conversationId, conversationId), lt(messages.conversationIndex, index))
            : mode === 'after' && index
                ? and(eq(messages.conversationId, conversationId), gt(messages.conversationIndex, index))
                : mode === 'from' && index
                    ? and(eq(messages.conversationId, conversationId), gte(messages.conversationIndex, index))
                    : eq(messages.conversationId, conversationId);

        return await this.drizzle.db.query.messages.findMany({
            where,
            with: {
                sender: {
                    columns: { id: true, username: true, displayName: true, avatar: true },
                },
            },
            orderBy: mode === 'after' || mode === 'from'
                ? [asc(messages.conversationIndex)]
                : [desc(messages.conversationIndex)],
            limit,
        });
    }

    private async getSerializedMessage(
        userId: number,
        conversationId: number,
        messageId: number,
        options: { clientTempId?: string; mentionedUserIds?: number[] } = {},
    ) {
        const [row] = await this.drizzle.db.query.messages.findMany({
            where: and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)),
            with: {
                sender: {
                    columns: { id: true, username: true, displayName: true, avatar: true },
                },
            },
            limit: 1,
        });

        if (!row) throw new NotFoundException('Không tìm thấy tin nhắn.');
        const [serialized] = await this.serializeMessages([row], userId);
        return {
            ...serialized,
            clientTempId: options.clientTempId,
            mentionedUserIds: options.mentionedUserIds,
        };
    }

    private async serializeMessages(rows: MessageRow[], currentUserId: number): Promise<SerializedMessage[]> {
        if (rows.length === 0) return [];

        const messageIds = rows.map((row) => row.id);
        const [reactionMap, replyMap, callEventMap] = await Promise.all([
            this.getReactionSummaries(messageIds, currentUserId),
            this.getReplySnapshots(rows),
            this.getCallEventSnapshots(rows, currentUserId),
        ]);

        return rows.map((row) => {
            const recalled = Boolean(row.recalledAt);
            const sender = {
                id: row.sender?.id ?? row.senderId,
                username: row.sender?.username ?? `user_${row.senderId}`,
                displayName: row.sender?.displayName ?? null,
                avatar: row.sender?.avatar ?? null,
            };
            const content = recalled ? '' : row.content ?? '';
            const type = recalled ? 'text' : row.type;
            const previewContent = recalled
                ? RECALL_PREVIEW
                : this.getMessagePreview(row.type as MessageType, row.content ?? '', row.fileName ?? undefined);

            return {
                id: row.id,
                clientMessageId: row.clientMessageId,
                content,
                type,
                fileUrl: recalled ? null : row.fileUrl,
                filePublicId: recalled ? null : row.filePublicId,
                fileResourceType: recalled ? null : row.fileResourceType,
                fileName: recalled ? null : row.fileName,
                fileMimeType: recalled ? null : row.fileMimeType,
                fileSizeBytes: recalled ? null : row.fileSizeBytes,
                fileFormat: recalled ? null : row.fileFormat,
                fileWidth: recalled ? null : row.fileWidth,
                fileHeight: recalled ? null : row.fileHeight,
                fileThumbnailUrl: recalled ? null : row.fileThumbnailUrl,
                fileDurationSeconds: recalled ? null : row.fileDurationSeconds,
                callSessionId: recalled ? null : row.callSessionId,
                callEvent: recalled || !row.callSessionId ? null : callEventMap[row.callSessionId] ?? null,
                conversationId: row.conversationId,
                senderId: row.senderId,
                senderName: sender.displayName || sender.username,
                sender,
                conversationIndex: row.conversationIndex,
                createdAt: row.createdAt,
                recalledAt: row.recalledAt,
                recalledByUserId: row.recalledByUserId,
                replyToMessageId: row.replyToMessageId,
                replyTo: row.replyToMessageId ? replyMap[row.replyToMessageId] ?? null : null,
                reactions: recalled ? [] : reactionMap[row.id] ?? [],
                previewContent,
            };
        });
    }

    private async getReactionSummaries(messageIds: number[], currentUserId: number) {
        if (messageIds.length === 0) return {} as Record<number, MessageReactionSummary[]>;

        const rows = await this.drizzle.db
            .select({
                messageId: messageReactions.messageId,
                userId: messageReactions.userId,
                emoji: messageReactions.emoji,
            })
            .from(messageReactions)
            .where(inArray(messageReactions.messageId, messageIds));

        const grouped: Record<number, Record<string, MessageReactionSummary>> = {};
        rows.forEach((row) => {
            grouped[row.messageId] ??= {};
            grouped[row.messageId][row.emoji] ??= {
                emoji: row.emoji,
                count: 0,
                reactedByMe: false,
            };
            grouped[row.messageId][row.emoji].count += 1;
            if (row.userId === currentUserId) grouped[row.messageId][row.emoji].reactedByMe = true;
        });

        return Object.fromEntries(Object.entries(grouped).map(([messageId, reactions]) => [
            Number(messageId),
            Object.values(reactions).sort((a, b) => b.count - a.count),
        ])) as Record<number, MessageReactionSummary[]>;
    }

    private async getReplySnapshots(rows: MessageRow[]) {
        const replyIds = [...new Set(rows.map((row) => row.replyToMessageId).filter((id): id is number => Boolean(id)))];
        if (replyIds.length === 0) return {} as Record<number, ReplySnapshot>;

        const replyRows = await this.drizzle.db.query.messages.findMany({
            where: inArray(messages.id, replyIds),
            with: {
                sender: {
                    columns: { id: true, username: true, displayName: true },
                },
            },
        });

        return Object.fromEntries(replyRows.map((row) => {
            const recalled = Boolean(row.recalledAt);
            return [row.id, {
                id: row.id,
                senderName: row.sender?.displayName ?? row.sender?.username ?? `User #${row.senderId}`,
                type: recalled ? 'text' : row.type,
                contentPreview: recalled ? RECALL_PREVIEW : this.getMessagePreview(row.type as MessageType, row.content ?? '', row.fileName ?? undefined),
                recalled,
            }];
        })) as Record<number, ReplySnapshot>;
    }

    private async getCallEventSnapshots(rows: MessageRow[], currentUserId: number) {
        const callSessionIds = [...new Set(
            rows
                .filter((row) => row.type === 'call_event')
                .map((row) => row.callSessionId)
                .filter((id): id is number => Boolean(id)),
        )];
        if (callSessionIds.length === 0) return {} as Record<number, CallEventSnapshot>;

        const [sessionRows, participantRows] = await Promise.all([
            this.drizzle.db
                .select({
                    id: callSessions.id,
                    kind: callSessions.kind,
                    status: callSessions.status,
                    endedReason: callSessions.endedReason,
                    startedAt: callSessions.startedAt,
                    answeredAt: callSessions.answeredAt,
                    endedAt: callSessions.endedAt,
                    startedByUserId: callSessions.startedByUserId,
                })
                .from(callSessions)
                .where(inArray(callSessions.id, callSessionIds)),
            this.drizzle.db
                .select({
                    callSessionId: callParticipants.callSessionId,
                    userId: callParticipants.userId,
                    status: callParticipants.status,
                })
                .from(callParticipants)
                .where(inArray(callParticipants.callSessionId, callSessionIds)),
        ]);

        const participantsByCallId = participantRows.reduce<Record<number, CallEventParticipantSnapshot[]>>(
            (grouped, participant) => {
                grouped[participant.callSessionId] ??= [];
                grouped[participant.callSessionId].push({
                    userId: participant.userId,
                    status: this.normalizeCallParticipantStatus(participant.status),
                });
                return grouped;
            },
            {},
        );

        return Object.fromEntries(sessionRows.map((session) => {
            const participants = participantsByCallId[session.id] ?? [];
            return [session.id, {
                callId: session.id,
                kind: session.kind === 'video' ? 'video' : 'audio',
                status: this.normalizeCallSessionStatus(session.status),
                endedReason: session.endedReason,
                startedAt: session.startedAt,
                answeredAt: session.answeredAt,
                endedAt: session.endedAt,
                durationSeconds: this.getCallDurationSeconds(session.answeredAt, session.endedAt),
                startedByUserId: session.startedByUserId,
                currentUserStatus: participants.find((participant) => participant.userId === currentUserId)?.status ?? 'none',
                participants,
            } satisfies CallEventSnapshot];
        })) as Record<number, CallEventSnapshot>;
    }

    private buildPageInfo(
        rows: MessageRow[],
        hasOlder: boolean,
        hasNewer: boolean,
    ): MessagePageInfo {
        return {
            startIndex: rows[0]?.conversationIndex ?? null,
            endIndex: rows[rows.length - 1]?.conversationIndex ?? null,
            hasOlder,
            hasNewer,
        };
    }

    private async assertReplyTarget(conversationId: number, messageId: number) {
        const [message] = await this.drizzle.db
            .select({ id: messages.id })
            .from(messages)
            .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
            .limit(1);

        if (!message) throw new BadRequestException('Tin nhắn được trả lời không tồn tại trong đoạn chat này.');
    }

    private async assertReactableMessage(conversationId: number, messageId: number) {
        const [message] = await this.drizzle.db
            .select({ id: messages.id, recalledAt: messages.recalledAt })
            .from(messages)
            .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
            .limit(1);

        if (!message) throw new NotFoundException('Không tìm thấy tin nhắn.');
        if (message.recalledAt) throw new BadRequestException('Không thể thả reaction cho tin nhắn đã thu hồi.');
    }

    private async assertMessageInConversation(conversationId: number, messageId: number) {
        const [message] = await this.drizzle.db
            .select({ id: messages.id })
            .from(messages)
            .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
            .limit(1);

        if (!message) throw new NotFoundException('Không tìm thấy tin nhắn.');
    }

    private async findExistingClientMessage(senderId: number, clientMessageId: string) {
        const [existing] = await this.drizzle.db
            .select({
                id: messages.id,
                conversationId: messages.conversationId,
            })
            .from(messages)
            .where(and(eq(messages.senderId, senderId), eq(messages.clientMessageId, clientMessageId)))
            .limit(1);

        return existing;
    }

    private async validateMentionedUsers(conversationId: number, mentionedUserIds: number[]) {
        const uniqueIds = [...new Set(mentionedUserIds.filter((id) => Number.isInteger(id) && id > 0))];
        if (uniqueIds.length === 0) return [];
        if (uniqueIds.length > MAX_MENTIONED_USERS) throw new BadRequestException('Quá nhiều người được mention.');

        const [conversation] = await this.drizzle.db
            .select({ isGroup: conversations.isGroup })
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);

        if (!conversation?.isGroup) throw new BadRequestException('Mention chỉ hỗ trợ trong nhóm.');

        const members = await this.drizzle.db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(and(eq(conversationMembers.conversationId, conversationId), inArray(conversationMembers.userId, uniqueIds)));

        if (members.length !== uniqueIds.length) throw new BadRequestException('Danh sách mention chứa người không thuộc nhóm.');
        return uniqueIds;
    }

    private async cleanupRecalledMedia(messageId: number, publicId: string, resourceType: string) {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                await this.mediaUploadService.deleteUploadedFile(publicId, resourceType);
                return;
            } catch (error) {
                this.logger.warn(`Không thể xóa media đã thu hồi messageId=${messageId}, publicId=${publicId}, attempt=${attempt}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    private normalizeClientMessageId(value: string | undefined) {
        const normalized = value?.trim();
        return normalized ? normalized.slice(0, 36) : null;
    }

    private normalizeLimit(limit: number | undefined) {
        if (!limit || limit < 1) return DEFAULT_MESSAGE_LIMIT;
        return Math.min(Math.floor(limit), 60);
    }

    private normalizeSearchLimit(limit: number | undefined) {
        if (!limit || limit < 1) return 20;
        return Math.min(Math.floor(limit), 50);
    }

    private normalizeCallSessionStatus(status: string): CallEventSessionStatus {
        if (status === 'missed' || status === 'cancelled') return status;
        return 'ended';
    }

    private normalizeCallParticipantStatus(status: string): CallEventParticipantStatus {
        if (status === 'ringing' || status === 'joined' || status === 'declined' || status === 'missed') {
            return status;
        }
        return 'left';
    }

    private getCallDurationSeconds(answeredAt: Date | null, endedAt: Date | null) {
        if (!answeredAt || !endedAt) return 0;
        return Math.max(0, Math.round((endedAt.getTime() - answeredAt.getTime()) / 1000));
    }

    private escapeLike(value: string) {
        return value.replace(/[\\%_]/g, (match) => `\\${match}`);
    }

    private getMessagePreview(type: MessageType, content: string, fileName?: string) {
        if (type === 'text') return content;
        if (type === 'image') return content || '[Ảnh]';
        if (type === 'video') return content || '[Video]';
        if (type === 'document') return fileName ? `[Tài liệu] ${fileName}` : '[Tài liệu]';
        if (type === 'call_event') return content || '[Cuộc gọi]';
        return content || '[GIF]';
    }

    private isHttpsUrl(value: string) {
        try {
            const url = new URL(value);
            return url.protocol === 'https:';
        } catch {
            return false;
        }
    }
}
