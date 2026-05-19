import { BadRequestException, Injectable, ForbiddenException } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { messages, conversations, conversationMembers, messageStatuses } from '../database/schema';
import { asc, desc, eq, and, gt, gte, inArray, like, lt } from 'drizzle-orm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ChatMessageType, UploadedMedia } from './media-upload.service';

export type MessageDeliveryStatus = 'sent' | 'delivered';
export type MessageType = 'text' | 'gif' | ChatMessageType;

export interface SendMessageInput {
    type?: 'text' | 'gif';
    content?: string;
    fileUrl?: string;
    clientTempId?: string;
}

export interface CreateMediaMessageInput {
    conversationId: number;
    senderName: string;
    caption?: string;
    clientTempId?: string;
    media: UploadedMedia;
}

export interface MessageStatusSnapshot {
    messageId: number;
    userId: number;
    status: MessageDeliveryStatus;
    updatedAt: Date;
}

export interface MessagePageInfo {
    startIndex: number | null;
    endIndex: number | null;
    hasOlder: boolean;
    hasNewer: boolean;
    anchorIndex?: number;
}

export interface MessageWindow {
    messages: Awaited<ReturnType<MessagesService['getMessages']>>;
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

const DEFAULT_MESSAGE_LIMIT = 40;
const AROUND_BEFORE_LIMIT = 20;
const AROUND_AFTER_LIMIT = 20;

@Injectable()
export class MessagesService {
    constructor(
        private drizzle: DrizzleService,
        private eventEmitter: EventEmitter2
    ) { }

    //check quyền
    async validateMember(userId: number, conversationId: number) {
        const member = await this.drizzle.db
            .select({
                isAdmin: conversationMembers.isAdmin,
            })
            .from(conversationMembers)
            .where(and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, userId)
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


    //----sendMessage----
    async sendMessage(
        senderId: number,
        conversationId: number,
        content: string,
        senderName: string,
        clientTempId?: string,
        input?: SendMessageInput,
    ) {
        await this.validateMember(senderId, conversationId);
        const messageType = input?.type ?? 'text';

        if (messageType === 'gif') {
            const gifUrl = input?.fileUrl?.trim();
            if (!gifUrl || !this.isHttpsUrl(gifUrl)) {
                throw new BadRequestException('GIF URL không hợp lệ.');
            }

            return this.createMessage({
                senderId,
                conversationId,
                senderName,
                type: 'gif',
                content: input?.content?.trim() || content?.trim() || '',
                clientTempId: input?.clientTempId ?? clientTempId,
                fileUrl: gifUrl,
            });
        }

        const textContent = content?.trim();
        if (!textContent) {
            throw new BadRequestException('Nội dung tin nhắn không được để trống.');
        }

        return this.createMessage({
            senderId,
            conversationId,
            senderName,
            type: 'text',
            content: textContent,
            clientTempId: input?.clientTempId ?? clientTempId,
        });
    }

    async createMediaMessage(senderId: number, input: CreateMediaMessageInput) {
        await this.validateMember(senderId, input.conversationId);

        return this.createMessage({
            senderId,
            conversationId: input.conversationId,
            senderName: input.senderName,
            type: input.media.type,
            content: input.caption?.trim() || '',
            clientTempId: input.clientTempId,
            fileUrl: input.media.fileUrl,
            filePublicId: input.media.filePublicId,
            fileResourceType: input.media.fileResourceType,
            fileName: input.media.fileName,
            fileMimeType: input.media.fileMimeType,
            fileSizeBytes: input.media.fileSizeBytes,
            fileFormat: input.media.fileFormat,
            fileWidth: input.media.fileWidth,
            fileHeight: input.media.fileHeight,
        });
    }

    private async createMessage(input: {
        senderId: number;
        conversationId: number;
        senderName: string;
        type: MessageType;
        content: string;
        clientTempId?: string;
        fileUrl?: string;
        filePublicId?: string;
        fileResourceType?: string;
        fileName?: string;
        fileMimeType?: string;
        fileSizeBytes?: number;
        fileFormat?: string | null;
        fileWidth?: number | null;
        fileHeight?: number | null;
    }) {
        const previewContent = this.getMessagePreview(input.type, input.content, input.fileName);

        return await this.drizzle.db.transaction(async (tx) => {
            const [conv] = await tx.select({ currentIdx: conversations.lastMessageIndex })
                .from(conversations)
                .where(eq(conversations.id, input.conversationId))
                .for('update');

            const nextIndex = (conv?.currentIdx || 0) + 1;

            const [newMessage] = await tx.insert(messages).values({
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
                conversationIndex: nextIndex,
            });

            const savedMsg = {
                id: newMessage.insertId,
                content: input.content,
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
                conversationId: input.conversationId,
                senderId: input.senderId,
                senderName: input.senderName,
                conversationIndex: nextIndex,
                createdAt: new Date(),
                clientTempId: input.clientTempId,
                previewContent,
            };

            const memberIds = await tx
                .select({ userId: conversationMembers.userId })
                .from(conversationMembers)
                .where(eq(conversationMembers.conversationId, input.conversationId));

            await tx.insert(messageStatuses).values(memberIds.map((member) => ({
                messageId: newMessage.insertId,
                userId: member.userId,
                status: 'sent',
            })));

            this.eventEmitter.emit('message.created', savedMsg);

            return savedMsg;
        });
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

    //----getMessages----
    async getMessages(userId: number, conversationId: number, limit = DEFAULT_MESSAGE_LIMIT) {
        // 1. Kiểm tra quyền
        await this.validateMember(userId, conversationId);

        // 2. Lấy dữ liệu
        const results = await this.drizzle.db.query.messages.findMany({
            where: eq(messages.conversationId, conversationId),
            with: {
                sender: {
                    columns: { id: true, username: true, avatar: true }
                }
            },
            orderBy: (messages, { desc }) => [desc(messages.createdAt)],
            limit: limit,
        });

        return results.reverse();
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
            return this.getMessagesAround(input.conversationId, input.anchorIndex);
        }
        if (input.beforeIndex && input.beforeIndex > 0) {
            return this.getMessagesBefore(input.conversationId, input.beforeIndex, limit);
        }
        if (input.afterIndex && input.afterIndex > 0) {
            return this.getMessagesAfter(input.conversationId, input.afterIndex, limit);
        }

        return this.getLatestMessages(input.conversationId, limit);
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
                like(messages.content, `%${this.escapeLike(keyword)}%`),
            ),
            with: {
                sender: {
                    columns: { id: true, username: true }
                }
            },
            orderBy: (messages, { desc }) => [desc(messages.conversationIndex)],
            limit,
        });

        return results.map((message) => ({
            messageId: message.id,
            conversationIndex: message.conversationIndex,
            content: message.content ?? '',
            type: message.type,
            senderName: message.sender?.username ?? `User #${message.senderId}`,
            createdAt: message.createdAt,
        }));
    }

    private async getLatestMessages(conversationId: number, limit: number): Promise<MessageWindow> {
        const rows = await this.findMessages(conversationId, limit + 1, 'latest');
        const hasOlder = rows.length > limit;
        const windowRows = rows.slice(0, limit).reverse();

        return {
            messages: windowRows,
            pageInfo: this.buildPageInfo(windowRows, hasOlder, false),
        };
    }

    private async getMessagesBefore(conversationId: number, beforeIndex: number, limit: number): Promise<MessageWindow> {
        const rows = await this.findMessages(conversationId, limit + 1, 'before', beforeIndex);
        const hasOlder = rows.length > limit;
        const windowRows = rows.slice(0, limit).reverse();

        return {
            messages: windowRows,
            pageInfo: this.buildPageInfo(windowRows, hasOlder, true),
        };
    }

    private async getMessagesAfter(conversationId: number, afterIndex: number, limit: number): Promise<MessageWindow> {
        const rows = await this.findMessages(conversationId, limit + 1, 'after', afterIndex);
        const hasNewer = rows.length > limit;
        const windowRows = rows.slice(0, limit);

        return {
            messages: windowRows,
            pageInfo: this.buildPageInfo(windowRows, true, hasNewer),
        };
    }

    private async getMessagesAround(conversationId: number, anchorIndex: number): Promise<MessageWindow> {
        const beforeRows = await this.findMessages(conversationId, AROUND_BEFORE_LIMIT + 1, 'before', anchorIndex);
        const afterRows = await this.findMessages(conversationId, AROUND_AFTER_LIMIT + 1, 'from', anchorIndex);
        const hasOlder = beforeRows.length > AROUND_BEFORE_LIMIT;
        const hasNewer = afterRows.length > AROUND_AFTER_LIMIT;
        const windowRows = [
            ...beforeRows.slice(0, AROUND_BEFORE_LIMIT).reverse(),
            ...afterRows.slice(0, AROUND_AFTER_LIMIT),
        ];

        return {
            messages: windowRows,
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
                    columns: { id: true, username: true, avatar: true }
                }
            },
            orderBy: mode === 'after' || mode === 'from'
                ? [asc(messages.conversationIndex)]
                : [desc(messages.conversationIndex)],
            limit,
        });
    }

    private buildPageInfo(
        rows: Awaited<ReturnType<MessagesService['findMessages']>>,
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

    private normalizeLimit(limit: number | undefined) {
        if (!limit || limit < 1) return DEFAULT_MESSAGE_LIMIT;
        return Math.min(Math.floor(limit), 60);
    }

    private normalizeSearchLimit(limit: number | undefined) {
        if (!limit || limit < 1) return 20;
        return Math.min(Math.floor(limit), 50);
    }

    private escapeLike(value: string) {
        return value.replace(/[\\%_]/g, (match) => `\\${match}`);
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

    private getMessagePreview(type: MessageType, content: string, fileName?: string) {
        if (type === 'text') return content;
        if (type === 'image') return content || '[Ảnh]';
        if (type === 'video') return content || '[Video]';
        if (type === 'document') return fileName ? `[Tài liệu] ${fileName}` : '[Tài liệu]';
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
