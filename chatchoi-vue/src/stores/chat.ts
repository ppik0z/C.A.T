import { defineStore } from 'pinia';
import { socket } from '../socket';
import { jwtDecode } from 'jwt-decode';
import { fetchConversationDetail } from '../services/conversation.service';
import { prepareMediaForUpload } from '../services/mediaProcessing.service';
import { uploadMediaMessage } from '../services/message.service';
import type {
    ChatMessage,
    ChatMessageType,
    Conversation,
    ConversationDetailLoadState,
    ConversationListUpdate,
    JwtIdentity,
    MemberReadState,
    MessageDeliveryStatus,
    MessageLoadState,
    MessagePageInfo,
    MessageReactionUpdate,
    MessageRecallUpdate,
    MessageSearchResult,
    MessageSearchState,
    MessageStatusSnapshot,
    MessageWindowMode,
    MessageStatusUpdate,
    ReadStateUpdate,
    TypingStateUpdate,
    TypingUser,
} from '../types/chat';
import type { PublicUserProfile, PublicUserSummary } from '../types/account';
import { getAccessToken } from '../services/session.runtime';

const PREFETCH_DELAY_MS = 250;
const CONVERSATION_DETAIL_TTL_MS = 60_000;
const TYPING_TTL_MS = 7_000;
const TYPING_REFRESH_MS = 2_000;
const MAX_MEDIA_FILE_BYTES = 10 * 1024 * 1024;
const MESSAGE_WINDOW_LIMIT = 40;
const typingExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface PendingMediaUpload {
    conversationId: number;
    file: File;
    caption: string;
    previewUrl: string;
    clientMessageId: string;
    replyToMessageId?: number;
    mentionedUserIds?: number[];
}

type MessageLoadDirection = 'replace' | 'older' | 'newer' | 'anchor';

const pendingMediaUploads = new Map<string, PendingMediaUpload>();

const delay = (milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
});

const appendUniqueMessage = (messages: ChatMessage[], message: ChatMessage): ChatMessage[] => {
    const clientKey = message.clientMessageId ?? message.clientTempId;
    if (clientKey) {
        const tempIndex = messages.findIndex((item) => item.clientMessageId === clientKey || item.clientTempId === clientKey);
        if (tempIndex !== -1) {
            return messages.map((item, index) => index === tempIndex ? { ...message, localStatus: 'sent' as const } : item);
        }
    }

    return messages.some((item) => item.id === message.id) ? messages : [...messages, message];
};

const mergeMessages = (messages: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
    return incoming.reduce((items, message) => appendUniqueMessage(items, message), messages)
        .sort((a, b) => {
            const indexA = a.conversationIndex ?? Number.MAX_SAFE_INTEGER;
            const indexB = b.conversationIndex ?? Number.MAX_SAFE_INTEGER;
            if (indexA !== indexB) return indexA - indexB;
            return a.id - b.id;
        });
};

const sortSearchResults = (results: MessageSearchResult[]): MessageSearchResult[] => {
    return [...results].sort((a, b) => a.conversationIndex - b.conversationIndex);
};

const defaultSearchState = (): MessageSearchState => ({
    keyword: '',
    results: [],
    activeResultIndex: -1,
    loading: false,
    error: null,
});

const getTypingKey = (conversationId: number, userId: number) => `${conversationId}:${userId}`;

const resolveLocalMessageType = (file: File): ChatMessageType => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
};

const isStaticImage = (file: File) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);

export const useChatStore = defineStore('chat', {
    state: () => ({
        messagesByConversationId: {} as Record<number, ChatMessage[]>,
        messagePageInfoByConversationId: {} as Record<number, MessagePageInfo>,
        messageWindowModeByConversationId: {} as Record<number, MessageWindowMode>,
        messageLoadDirectionByConversationId: {} as Record<number, MessageLoadDirection>,
        messageSearchStateByConversationId: {} as Record<number, MessageSearchState>,
        messageStatusesByMessageId: {} as Record<number, Record<number, MessageDeliveryStatus>>,
        memberReadStatesByConversationId: {} as Record<number, MemberReadState[]>,
        typingUsersByConversationId: {} as Record<number, TypingUser[]>,
        lastTypingSentAtByConversationId: {} as Record<number, number>,
        messageLoadStateByConversationId: {} as Record<number, MessageLoadState>,
        conversationDetailsById: {} as Record<number, Conversation>,
        conversationDetailLoadStateById: {} as Record<number, ConversationDetailLoadState>,
        conversationDetailFetchedAtById: {} as Record<number, number>,
        conversationDetailPromisesById: {} as Record<number, Promise<Conversation> | undefined>,
        currentConversationId: null as number | null,
        replyTarget: null as ChatMessage | null,
        myId: null as number | null,
        isConnected: false,
        conversations: [] as Conversation[],
        myUserName: null as string | null,
        myDisplayName: null as string | null,
        myAvatar: null as string | null,
    }),

    getters: {
        currentMessages(state): ChatMessage[] {
            if (!state.currentConversationId) return [];
            return state.messagesByConversationId[state.currentConversationId] ?? [];
        },
    },

    actions: {
        setIdentity(token: string) {
            try {
                const decoded = jwtDecode<JwtIdentity>(token);
                this.myId = decoded.userId; // Lấy userId từ Token
                if (decoded.username) this.myUserName = decoded.username;
                if (decoded.displayName !== undefined) this.myDisplayName = decoded.displayName;
                console.log("Định danh thành công, ID: ", this.myId);
            } catch (error) {
                console.error("Token lỏ!");
            }
        },

        resetSession() {
            this.$reset();
            typingExpiryTimers.forEach((timer) => clearTimeout(timer));
            typingExpiryTimers.clear();
        },

        applyCurrentUserProfile(profile: PublicUserSummary) {
            if (this.myId !== null && profile.id !== this.myId) return;
            this.myId = profile.id;
            this.myUserName = profile.username;
            this.myDisplayName = profile.displayName;
            this.myAvatar = profile.avatar;
        },

        applyUserProfileUpdate(profile: PublicUserProfile) {
            if (profile.id === this.myId) {
                this.applyCurrentUserProfile(profile);
            }

            this.conversations.forEach((conversation) => {
                if (!conversation.isGroup && conversation.friend?.id === profile.id) {
                    conversation.friend = {
                        ...conversation.friend,
                        username: profile.username,
                        displayName: profile.displayName,
                        avatar: profile.avatar,
                    };
                }
            });

            Object.values(this.conversationDetailsById).forEach((detail) => {
                detail.members?.forEach((member) => {
                    if (member.userId === profile.id) {
                        member.username = profile.username;
                        member.displayName = profile.displayName;
                        member.avatar = profile.avatar;
                    }
                });
            });
        },

        setMessagesForConversation(
            conversationId: number,
            msgs: ChatMessage[],
            statuses: MessageStatusSnapshot[] = [],
            readStates: MemberReadState[] = [],
            pageInfo?: MessagePageInfo,
        ) {
            this.replaceMessageWindow(conversationId, msgs, statuses, readStates, pageInfo);
        },

        replaceMessageWindow(
            conversationId: number,
            msgs: ChatMessage[],
            statuses: MessageStatusSnapshot[] = [],
            readStates: MemberReadState[] = [],
            pageInfo?: MessagePageInfo,
            mode: MessageWindowMode = 'latest',
        ) {
            this.messagesByConversationId[conversationId] = mergeMessages([], msgs);
            this.setMessageStatuses(statuses);
            this.memberReadStatesByConversationId[conversationId] = readStates;
            if (pageInfo) this.messagePageInfoByConversationId[conversationId] = pageInfo;
            this.messageWindowModeByConversationId[conversationId] = mode;
            this.messageLoadStateByConversationId[conversationId] = 'loaded';
        },

        prependOlderMessages(conversationId: number, msgs: ChatMessage[], pageInfo?: MessagePageInfo, statuses: MessageStatusSnapshot[] = []) {
            this.messagesByConversationId[conversationId] = mergeMessages(msgs, this.messagesByConversationId[conversationId] ?? []);
            this.setMessageStatuses(statuses);
            if (pageInfo) {
                const current = this.messagePageInfoByConversationId[conversationId];
                this.messagePageInfoByConversationId[conversationId] = {
                    ...pageInfo,
                    endIndex: current?.endIndex ?? pageInfo.endIndex,
                    hasNewer: current?.hasNewer ?? pageInfo.hasNewer,
                    anchorIndex: current?.anchorIndex,
                };
            }
            this.messageLoadStateByConversationId[conversationId] = 'loaded';
        },

        appendNewerMessages(conversationId: number, msgs: ChatMessage[], pageInfo?: MessagePageInfo, statuses: MessageStatusSnapshot[] = []) {
            this.messagesByConversationId[conversationId] = mergeMessages(this.messagesByConversationId[conversationId] ?? [], msgs);
            this.setMessageStatuses(statuses);
            if (pageInfo) {
                const current = this.messagePageInfoByConversationId[conversationId];
                this.messagePageInfoByConversationId[conversationId] = {
                    ...pageInfo,
                    startIndex: current?.startIndex ?? pageInfo.startIndex,
                    hasOlder: current?.hasOlder ?? pageInfo.hasOlder,
                    anchorIndex: current?.anchorIndex,
                };
            }
            this.messageLoadStateByConversationId[conversationId] = 'loaded';
        },

        setMessageStatuses(statuses: MessageStatusSnapshot[]) {
            statuses.forEach((item) => {
                this.messageStatusesByMessageId[item.messageId] = {
                    ...this.messageStatusesByMessageId[item.messageId],
                    [item.userId]: item.status,
                };
            });
        },

        setMessageLoadError(conversationId: number) {
            this.messageLoadStateByConversationId[conversationId] = 'error';
        },

        requestMessagesForConversation(conversationId: number, limit = MESSAGE_WINDOW_LIMIT) {
            const loadState = this.messageLoadStateByConversationId[conversationId] ?? 'idle';
            if (loadState === 'loading' || loadState === 'loaded') return;

            this.messageLoadStateByConversationId[conversationId] = 'loading';
            this.messageLoadDirectionByConversationId[conversationId] = 'replace';
            socket.emit('load_messages', { conversationId, limit });
        },

        loadLatestMessages(conversationId: number) {
            this.messageLoadStateByConversationId[conversationId] = 'loading';
            this.messageWindowModeByConversationId[conversationId] = 'latest';
            this.messageLoadDirectionByConversationId[conversationId] = 'replace';
            socket.emit('load_messages', { conversationId, limit: MESSAGE_WINDOW_LIMIT });
        },

        loadOlderMessages(conversationId: number) {
            const pageInfo = this.messagePageInfoByConversationId[conversationId];
            if (this.messageLoadStateByConversationId[conversationId] === 'loading') return false;
            if (!pageInfo?.hasOlder || !pageInfo.startIndex) return false;

            this.messageLoadStateByConversationId[conversationId] = 'loading';
            this.messageLoadDirectionByConversationId[conversationId] = 'older';
            socket.emit('load_messages', {
                conversationId,
                limit: MESSAGE_WINDOW_LIMIT,
                beforeIndex: pageInfo.startIndex,
            });
            return true;
        },

        loadNewerMessages(conversationId: number) {
            const pageInfo = this.messagePageInfoByConversationId[conversationId];
            if (this.messageLoadStateByConversationId[conversationId] === 'loading') return false;
            if (!pageInfo?.hasNewer || !pageInfo.endIndex) return false;

            this.messageLoadStateByConversationId[conversationId] = 'loading';
            this.messageLoadDirectionByConversationId[conversationId] = 'newer';
            socket.emit('load_messages', {
                conversationId,
                limit: MESSAGE_WINDOW_LIMIT,
                afterIndex: pageInfo.endIndex,
            });
            return true;
        },

        loadMessagesAround(conversationId: number, anchorIndex: number) {
            this.messageLoadStateByConversationId[conversationId] = 'loading';
            this.messageWindowModeByConversationId[conversationId] = 'search';
            this.messageLoadDirectionByConversationId[conversationId] = 'anchor';
            socket.emit('load_messages', {
                conversationId,
                limit: MESSAGE_WINDOW_LIMIT,
                anchorIndex,
            });
        },

        async prefetchMessagesForConversations(conversationIds: number[]) {
            for (const conversationId of conversationIds) {
                this.requestMessagesForConversation(conversationId);
                await delay(PREFETCH_DELAY_MS);
            }
        },

        selectConversation(conversationId: number) {
            this.currentConversationId = conversationId;
            const currentConv = this.conversations.find((conversation) => conversation.id === conversationId);
            const latestIndex = currentConv?.lastMessageIndex ?? 0;
            const lastSeenIndex = currentConv?.lastSeenMessageIndex ?? 0;

            if (latestIndex > 0 && latestIndex > lastSeenIndex) {
                this.markAsRead(conversationId, latestIndex);
            } else {
                this.clearUnread(conversationId);
            }

            socket.emit('join_room', { conversationId });
            this.requestMessagesForConversation(conversationId);
        },

        handleMessagesLoaded(
            conversationId: number,
            msgs: ChatMessage[],
            statuses: MessageStatusSnapshot[] = [],
            readStates: MemberReadState[] = [],
            pageInfo?: MessagePageInfo,
        ) {
            const loadDirection = this.messageLoadDirectionByConversationId[conversationId] ?? 'replace';
            delete this.messageLoadDirectionByConversationId[conversationId];

            if (loadDirection === 'anchor' || pageInfo?.anchorIndex) {
                this.replaceMessageWindow(conversationId, msgs, statuses, readStates, pageInfo, 'search');
                return;
            }

            if (loadDirection === 'older') {
                this.prependOlderMessages(conversationId, msgs, pageInfo, statuses);
                this.memberReadStatesByConversationId[conversationId] = readStates;
                return;
            }

            if (loadDirection === 'newer') {
                this.appendNewerMessages(conversationId, msgs, pageInfo, statuses);
                this.memberReadStatesByConversationId[conversationId] = readStates;
                return;
            }

            this.replaceMessageWindow(
                conversationId,
                msgs,
                statuses,
                readStates,
                pageInfo,
                this.messageWindowModeByConversationId[conversationId] ?? 'latest',
            );
        },

        searchMessages(conversationId: number, keyword: string) {
            const trimmedKeyword = keyword.trim();
            const currentState = this.messageSearchStateByConversationId[conversationId] ?? defaultSearchState();

            this.messageSearchStateByConversationId[conversationId] = {
                ...currentState,
                keyword,
                loading: trimmedKeyword.length >= 2,
                error: null,
                results: trimmedKeyword.length >= 2 ? currentState.results : [],
                activeResultIndex: trimmedKeyword.length >= 2 ? currentState.activeResultIndex : -1,
            };

            if (trimmedKeyword.length < 2) return;

            socket.emit('search_messages', {
                conversationId,
                keyword: trimmedKeyword,
                limit: 20,
            });
        },

        applySearchResults(conversationId: number, keyword: string, results: MessageSearchResult[]) {
            const currentKeyword = this.messageSearchStateByConversationId[conversationId]?.keyword.trim();
            if (currentKeyword && currentKeyword !== keyword.trim()) return;

            const sortedResults = sortSearchResults(results);
            const activeResultIndex = sortedResults.length > 0 ? sortedResults.length - 1 : -1;
            this.messageSearchStateByConversationId[conversationId] = {
                keyword,
                results: sortedResults,
                activeResultIndex,
                loading: false,
                error: null,
            };

            if (activeResultIndex >= 0) {
                this.loadMessagesAround(conversationId, sortedResults[activeResultIndex].conversationIndex);
            }
        },

        setSearchError(conversationId: number, message: string) {
            const currentState = this.messageSearchStateByConversationId[conversationId] ?? defaultSearchState();
            this.messageSearchStateByConversationId[conversationId] = {
                ...currentState,
                loading: false,
                error: message,
            };
        },

        clearMessageSearch(conversationId: number) {
            this.messageSearchStateByConversationId[conversationId] = defaultSearchState();
            if (this.messageWindowModeByConversationId[conversationId] === 'search') {
                this.loadLatestMessages(conversationId);
            }
        },

        navigateSearchResult(conversationId: number, direction: 'previous' | 'next') {
            const state = this.messageSearchStateByConversationId[conversationId];
            if (!state || state.results.length === 0) return null;

            const delta = direction === 'next' ? 1 : -1;
            const nextIndex = Math.min(Math.max(state.activeResultIndex + delta, 0), state.results.length - 1);
            const result = state.results[nextIndex];
            if (!result) return null;

            this.messageSearchStateByConversationId[conversationId] = {
                ...state,
                activeResultIndex: nextIndex,
            };
            this.loadMessagesAround(conversationId, result.conversationIndex);
            return result;
        },

        // Xóa số lượng tin nhắn chưa đọc của một phòng
        clearUnread(conversationId: number) {
            const conv = this.conversations.find(c => c.id === conversationId);
            if (conv) {
                conv.unreadCount = 0;
            }
        },

        // Thêm action này để bắn Socket báo đã đọc
        markAsRead(conversationId: number, lastMessageIndex: number) {
            socket.emit('mark_as_read', {
                conversationId: conversationId,
                lastMessageIndex: lastMessageIndex
            });

            const conv = this.conversations.find(c => c.id === conversationId);
            if (conv) {
                conv.unreadCount = 0;
                conv.lastSeenMessageIndex = lastMessageIndex;
            }
        },

        // Thêm 1 tin nhắn mới 
        pushMessage(msg: ChatMessage) {
            if (!msg.conversationId) return;

            // Tránh trùng lặp nếu đã nhận từ callback gửi tin
            const messages = this.messagesByConversationId[msg.conversationId] ?? [];
            this.messagesByConversationId[msg.conversationId] = appendUniqueMessage(messages, msg);
        },

        // Hàm gửi tin nhắn đi
        setReplyTarget(message: ChatMessage) {
            if (message.recalledAt) return;
            this.replyTarget = message;
        },

        clearReplyTarget() {
            this.replyTarget = null;
        },

        sendMessage(content: string, mentionedUserIds: number[] = []) {
            if (!content.trim() || !this.currentConversationId || !this.myUserName) return;

            const clientTempId = crypto.randomUUID();
            const replyTo = this.replyTarget;
            const optimisticMessage: ChatMessage = {
                id: -Date.now(),
                clientTempId,
                clientMessageId: clientTempId,
                conversationId: this.currentConversationId,
                type: 'text',
                content: content.trim(),
                createdAt: new Date(),
                senderId: this.myId ?? undefined,
                senderName: this.myDisplayName || this.myUserName,
                sender: this.myId ? { id: this.myId, username: this.myUserName, displayName: this.myDisplayName } : undefined,
                replyToMessageId: replyTo?.id,
                replyTo: replyTo ? {
                    id: replyTo.id,
                    senderName: replyTo.senderName ?? replyTo.sender?.displayName ?? replyTo.sender?.username ?? 'Unknown',
                    type: replyTo.type ?? 'text',
                    contentPreview: replyTo.recalledAt ? 'Tin nhắn đã được thu hồi' : (replyTo.content || replyTo.fileName || '[Media]'),
                    recalled: Boolean(replyTo.recalledAt),
                } : null,
                localStatus: 'sending',
            };

            this.pushMessage(optimisticMessage);
            this.stopTyping(this.currentConversationId);
            this.clearReplyTarget();

            socket.emit("send_message", {
                conversationId: this.currentConversationId,
                type: 'text',
                content: content.trim(),
                clientTempId,
                clientMessageId: clientTempId,
                replyToMessageId: replyTo?.id,
                mentionedUserIds,
            }, (response: ChatMessage) => {
                // Nhận phản hồi "savedMsg" từ Server và cập nhật UI 
                if (response && response.id) {
                    this.pushMessage(response);
                }
            });
        },

        async sendMediaMessage(file: File, caption = '', mentionedUserIds: number[] = []) {
            if (!this.currentConversationId || !this.myUserName) return;

            const token = getAccessToken();
            if (!token) throw new Error('Bạn cần đăng nhập để gửi file.');
            if (file.size > MAX_MEDIA_FILE_BYTES) throw new Error('File tối đa 10 MB.');

            const clientTempId = crypto.randomUUID();
            const conversationId = this.currentConversationId;
            const replyTo = this.replyTarget;
            const previewUrl = URL.createObjectURL(file);
            const optimisticMessage: ChatMessage = {
                id: -Date.now(),
                clientTempId,
                clientMessageId: clientTempId,
                conversationId,
                type: resolveLocalMessageType(file),
                content: caption.trim(),
                createdAt: new Date(),
                fileUrl: previewUrl,
                fileName: file.name,
                fileMimeType: file.type,
                fileSizeBytes: file.size,
                originalFileSizeBytes: file.size,
                uploadProgress: 0,
                compressionProgress: 0,
                senderId: this.myId ?? undefined,
                senderName: this.myDisplayName || this.myUserName,
                sender: this.myId ? { id: this.myId, username: this.myUserName, displayName: this.myDisplayName } : undefined,
                replyToMessageId: replyTo?.id,
                replyTo: replyTo ? {
                    id: replyTo.id,
                    senderName: replyTo.senderName ?? replyTo.sender?.displayName ?? replyTo.sender?.username ?? 'Unknown',
                    type: replyTo.type ?? 'text',
                    contentPreview: replyTo.recalledAt ? 'Tin nhắn đã được thu hồi' : (replyTo.content || replyTo.fileName || '[Media]'),
                    recalled: Boolean(replyTo.recalledAt),
                } : null,
                localStatus: 'sending',
            };

            pendingMediaUploads.set(clientTempId, {
                conversationId,
                file,
                caption: caption.trim(),
                previewUrl,
                clientMessageId: clientTempId,
                replyToMessageId: replyTo?.id,
                mentionedUserIds,
            });
            this.pushMessage(optimisticMessage);
            this.stopTyping(conversationId);
            this.clearReplyTarget();
            await this.uploadPendingMedia(clientTempId);
        },

        async retryMediaMessage(clientTempId: string) {
            const pendingUpload = pendingMediaUploads.get(clientTempId);
            const token = getAccessToken();
            if (!pendingUpload || !token) return;

            await this.uploadPendingMedia(clientTempId);
        },

        async uploadPendingMedia(clientTempId: string) {
            const pendingUpload = pendingMediaUploads.get(clientTempId);
            if (!pendingUpload) return;

            this.updateLocalMessage(pendingUpload.conversationId, clientTempId, {
                localStatus: 'sending',
                uploadError: undefined,
                canRetry: false,
                uploadProgress: 0,
                compressionProgress: 0,
            });

            let uploadFile = pendingUpload.file;
            try {
                if (pendingUpload.file.size > MAX_MEDIA_FILE_BYTES) {
                    throw new Error('File tối đa 10 MB.');
                }

                if (isStaticImage(pendingUpload.file)) {
                    this.updateLocalMessage(pendingUpload.conversationId, clientTempId, {
                        localStatus: 'compressing',
                    });
                    const processedFile = await prepareMediaForUpload(pendingUpload.file, {
                        onCompressionProgress: (progress) => {
                            this.updateLocalMessage(pendingUpload.conversationId, clientTempId, {
                                compressionProgress: progress,
                            });
                        },
                    });
                    uploadFile = processedFile.file;

                    if (uploadFile.size > MAX_MEDIA_FILE_BYTES) {
                        throw new Error('Ảnh WebP sau khi chuyển đổi vẫn vượt quá 10 MB.');
                    }

                    this.updateLocalMessage(pendingUpload.conversationId, clientTempId, {
                        fileName: uploadFile.name,
                        fileMimeType: uploadFile.type,
                        fileSizeBytes: uploadFile.size,
                        compressedFileSizeBytes: uploadFile.size,
                        compressionProgress: 100,
                    });
                }

                this.updateLocalMessage(pendingUpload.conversationId, clientTempId, {
                    localStatus: 'uploading',
                    uploadProgress: 0,
                });

                const response = await uploadMediaMessage({
                    conversationId: pendingUpload.conversationId,
                    file: uploadFile,
                    caption: pendingUpload.caption,
                    clientTempId,
                    clientMessageId: pendingUpload.clientMessageId,
                    replyToMessageId: pendingUpload.replyToMessageId,
                    mentionedUserIds: pendingUpload.mentionedUserIds,
                    onProgress: (progress) => {
                        this.updateLocalMessage(pendingUpload.conversationId, clientTempId, {
                            uploadProgress: progress,
                        });
                    },
                });
                this.pushMessage(response);
                URL.revokeObjectURL(pendingUpload.previewUrl);
                pendingMediaUploads.delete(clientTempId);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Không thể gửi file.';
                this.markLocalMessageFailed(pendingUpload.conversationId, clientTempId, message);
                console.error(error);
            }
        },

        sendGifMessage(gifUrl: string, caption = '') {
            if (!gifUrl.trim() || !this.currentConversationId || !this.myUserName) return;

            const clientTempId = crypto.randomUUID();
            const optimisticMessage: ChatMessage = {
                id: -Date.now(),
                clientTempId,
                clientMessageId: clientTempId,
                conversationId: this.currentConversationId,
                type: 'gif',
                content: caption.trim(),
                createdAt: new Date(),
                fileUrl: gifUrl.trim(),
                senderId: this.myId ?? undefined,
                senderName: this.myDisplayName || this.myUserName,
                sender: this.myId ? { id: this.myId, username: this.myUserName, displayName: this.myDisplayName } : undefined,
                localStatus: 'sending',
            };

            this.pushMessage(optimisticMessage);
            this.stopTyping(this.currentConversationId);

            socket.emit("send_message", {
                conversationId: this.currentConversationId,
                type: 'gif',
                content: caption.trim(),
                fileUrl: gifUrl.trim(),
                clientTempId,
                clientMessageId: clientTempId,
            }, (response: ChatMessage) => {
                if (response && response.id) {
                    this.pushMessage(response);
                }
            });
        },

        markLocalMessageFailed(conversationId: number, clientTempId: string, uploadError = 'Không thể gửi file.') {
            this.updateLocalMessage(conversationId, clientTempId, {
                localStatus: 'failed',
                uploadError,
                canRetry: true,
            });
        },

        updateLocalMessage(conversationId: number, clientTempId: string, patch: Partial<ChatMessage>) {
            const messages = this.messagesByConversationId[conversationId] ?? [];
            this.messagesByConversationId[conversationId] = messages.map((message) => {
                return message.clientTempId === clientTempId
                    ? { ...message, ...patch }
                    : message;
            });
        },

        setConversations(convs: Conversation[]) {
            this.conversations = convs;
        },

        upsertConversation(conversation: Conversation) {
            const index = this.conversations.findIndex((item) => item.id === conversation.id);
            if (index === -1) {
                this.conversations.unshift(conversation);
                return;
            }

            this.conversations[index] = {
                ...this.conversations[index],
                ...conversation,
                members: conversation.members ?? this.conversations[index].members,
            };

            if (conversation.members) {
                this.upsertConversationDetail(conversation);
            }
        },

        upsertConversationDetail(conversation: Conversation) {
            this.conversationDetailsById[conversation.id] = {
                ...this.conversationDetailsById[conversation.id],
                ...conversation,
                members: conversation.members ?? this.conversationDetailsById[conversation.id]?.members,
            };
            this.conversationDetailLoadStateById[conversation.id] = 'loaded';
            this.conversationDetailFetchedAtById[conversation.id] = Date.now();

            const index = this.conversations.findIndex((item) => item.id === conversation.id);
            if (index !== -1) {
                this.conversations[index] = {
                    ...this.conversations[index],
                    ...conversation,
                    members: conversation.members ?? this.conversations[index].members,
                };
            }
        },

        invalidateConversationDetail(conversationId: number) {
            delete this.conversationDetailFetchedAtById[conversationId];
            this.conversationDetailLoadStateById[conversationId] = 'idle';
        },

        async loadConversationDetail(conversationId: number, force = false) {
            const cached = this.conversationDetailsById[conversationId];
            const fetchedAt = this.conversationDetailFetchedAtById[conversationId] ?? 0;
            const isFresh = Date.now() - fetchedAt < CONVERSATION_DETAIL_TTL_MS;

            if (!force && cached && isFresh) return cached;
            if (!force && this.conversationDetailPromisesById[conversationId]) {
                return this.conversationDetailPromisesById[conversationId];
            }

            this.conversationDetailLoadStateById[conversationId] = 'loading';
            const request = fetchConversationDetail(conversationId)
                .then((detail) => {
                    this.upsertConversationDetail(detail);
                    return detail;
                })
                .catch((error) => {
                    this.conversationDetailLoadStateById[conversationId] = 'error';
                    throw error;
                })
                .finally(() => {
                    delete this.conversationDetailPromisesById[conversationId];
                });

            this.conversationDetailPromisesById[conversationId] = request;
            return request;
        },

        removeConversation(conversationId: number) {
            this.conversations = this.conversations.filter((conversation) => conversation.id !== conversationId);
            delete this.messagesByConversationId[conversationId];
            delete this.messagePageInfoByConversationId[conversationId];
            delete this.messageWindowModeByConversationId[conversationId];
            delete this.messageLoadDirectionByConversationId[conversationId];
            delete this.messageSearchStateByConversationId[conversationId];
            delete this.memberReadStatesByConversationId[conversationId];
            delete this.typingUsersByConversationId[conversationId];
            delete this.messageLoadStateByConversationId[conversationId];
            delete this.conversationDetailsById[conversationId];
            delete this.conversationDetailLoadStateById[conversationId];
            delete this.conversationDetailFetchedAtById[conversationId];
            delete this.conversationDetailPromisesById[conversationId];
            if (this.currentConversationId === conversationId) {
                this.currentConversationId = null;
            }
        },

        // Set online khi vừa connect
        setUsersOnline(userIds: number[]) {
            this.conversations.forEach(conv => {
                if (!conv.isGroup && conv.friend && userIds.includes(conv.friend.id)) {
                    conv.isOnline = true;
                }
            });

            Object.values(this.conversationDetailsById).forEach((detail) => {
                detail.members?.forEach((member) => {
                    member.isOnline = userIds.includes(member.userId);
                });
            });
        },

        // Cập nhật từng người khi nhận thông báo
        updateUserStatus(userId: number, status: string) {
            const conv = this.conversations.find(c => !c.isGroup && c.friend?.id === userId);
            if (conv) {
                conv.isOnline = (status === 'online');
            }

            Object.values(this.conversationDetailsById).forEach((detail) => {
                detail.members?.forEach((member) => {
                    if (member.userId === userId) {
                        member.isOnline = status === 'online';
                    }
                });
            });
        },

        // Cập nhật ConversationList
        updateConversationList(data: ConversationListUpdate) {
            const index = this.conversations.findIndex(c => c.id === data.conversationId);
            if (index !== -1) {
                const conv = this.conversations[index];
                const isCallEvent = data.lastMessageType === 'call_event';
                conv.lastMessageContent = data.isRecallUpdate
                    ? data.lastMessageContent
                    : isCallEvent
                    ? data.lastMessageContent
                    : (data.senderName === 'Bạn' ? 'Bạn: ' : `${data.senderName}: `) + data.lastMessageContent;
                conv.lastMessage = {
                    id: data.lastMessageId,
                    content: data.lastMessageContent,
                    senderName: data.senderName,
                    type: data.lastMessageType,
                };
                conv.lastMessageIndex = data.lastMessageIndex;

                if (data.isRecallUpdate) {
                    conv.unreadCount = conv.unreadCount || 0;
                } else if (this.currentConversationId !== data.conversationId) {
                    conv.unreadCount = (conv.unreadCount || 0) + 1;
                } else {
                    this.markAsRead(data.conversationId, data.lastMessageIndex);
                }

                // Đẩy lên Top
                this.conversations.splice(index, 1);
                this.conversations.unshift(conv);
            }
        },

        setReaction(message: ChatMessage, emoji: string) {
            if (!message.conversationId || message.recalledAt) return;
            socket.emit('message:reaction:set', {
                conversationId: message.conversationId,
                messageId: message.id,
                emoji,
            });
        },

        removeReaction(message: ChatMessage) {
            if (!message.conversationId) return;
            socket.emit('message:reaction:remove', {
                conversationId: message.conversationId,
                messageId: message.id,
            });
        },

        recallMessage(message: ChatMessage) {
            if (!message.conversationId || message.senderId !== this.myId || message.recalledAt) return;
            socket.emit('message:recall', {
                conversationId: message.conversationId,
                messageId: message.id,
            });
        },

        applyReactionUpdate(update: MessageReactionUpdate) {
            const messages = this.messagesByConversationId[update.conversationId] ?? [];
            this.messagesByConversationId[update.conversationId] = messages.map((message) => {
                return message.id === update.messageId
                    ? { ...message, reactions: update.reactions }
                    : message;
            });
        },

        applyRecallUpdate(update: MessageRecallUpdate) {
            const messages = this.messagesByConversationId[update.conversationId] ?? [];
            this.messagesByConversationId[update.conversationId] = messages.map((message) => {
                if (message.id === update.messageId) {
                    return {
                        ...message,
                        content: '',
                        type: 'text',
                        fileUrl: null,
                        filePublicId: null,
                        fileResourceType: null,
                        fileName: null,
                        fileMimeType: null,
                        fileSizeBytes: null,
                        fileFormat: null,
                        fileWidth: null,
                        fileHeight: null,
                        recalledAt: update.recalledAt,
                        recalledByUserId: update.recalledByUserId,
                        reactions: [],
                    };
                }

                if (message.replyTo?.id === update.messageId) {
                    return {
                        ...message,
                        replyTo: {
                            ...message.replyTo,
                            contentPreview: 'Tin nhắn đã được thu hồi',
                            recalled: true,
                        },
                    };
                }

                return message;
            });

            if (update.lastMessage) {
                const conv = this.conversations.find((conversation) => conversation.id === update.conversationId);
                if (conv) {
                    conv.lastMessage = {
                        id: update.lastMessage.id,
                        content: update.lastMessage.content,
                        senderName: conv.lastMessage.senderName,
                        type: update.lastMessage.type,
                    };
                    conv.lastMessageContent = update.lastMessage.content;
                }
            }
        },

        applyMessageStatusUpdate(update: MessageStatusUpdate) {
            this.messageStatusesByMessageId[update.messageId] = {
                ...this.messageStatusesByMessageId[update.messageId],
                [update.userId]: update.status,
            };
        },

        applyReadStateUpdate(update: ReadStateUpdate) {
            const states = this.memberReadStatesByConversationId[update.conversationId] ?? [];
            const nextState: MemberReadState = {
                userId: update.userId,
                username: update.username,
                lastSeenMessageIndex: update.lastSeenMessageIndex,
            };
            const existingIndex = states.findIndex((item) => item.userId === update.userId);

            this.memberReadStatesByConversationId[update.conversationId] = existingIndex === -1
                ? [...states, nextState]
                : states.map((item, index) => index === existingIndex ? nextState : item);
        },

        getMessageDisplayStatus(message: ChatMessage, conversation: Conversation | null) {
            if (message.localStatus === 'sending') return 'Đang gửi';
            if (message.localStatus === 'compressing') return 'Đang nén';
            if (message.localStatus === 'uploading') return 'Đang tải lên';
            if (message.localStatus === 'failed') return 'Gửi thất bại';
            if (!conversation || this.myId === null) return 'Đã gửi';

            const messageIndex = message.conversationIndex ?? 0;
            const readStates = this.memberReadStatesByConversationId[conversation.id] ?? [];
            const seenCount = readStates.filter((state) => {
                return state.userId !== this.myId && messageIndex > 0 && state.lastSeenMessageIndex >= messageIndex;
            }).length;

            if (conversation.isGroup && seenCount > 0) return `${seenCount} đã xem`;
            if (!conversation.isGroup && seenCount > 0) return 'Đã xem';

            const statusByUser = this.messageStatusesByMessageId[message.id] ?? {};
            const deliveredCount = Object.entries(statusByUser).filter(([userId, status]) => {
                return Number(userId) !== this.myId && status === 'delivered';
            }).length;

            return deliveredCount > 0 ? 'Đã nhận' : 'Đã gửi';
        },

        startTyping(conversationId: number) {
            const now = Date.now();
            const lastSentAt = this.lastTypingSentAtByConversationId[conversationId] ?? 0;
            if (now - lastSentAt < TYPING_REFRESH_MS) return;

            this.lastTypingSentAtByConversationId[conversationId] = now;
            socket.emit('typing_start', { conversationId });
        },

        stopTyping(conversationId: number) {
            delete this.lastTypingSentAtByConversationId[conversationId];
            socket.emit('typing_stop', { conversationId });
        },

        applyTypingState(update: TypingStateUpdate) {
            if (update.userId === this.myId) return;

            const users = this.typingUsersByConversationId[update.conversationId] ?? [];
            const existingIndex = users.findIndex((item) => item.userId === update.userId);
            const key = getTypingKey(update.conversationId, update.userId);

            if (!update.isTyping) {
                this.typingUsersByConversationId[update.conversationId] = users.filter((item) => item.userId !== update.userId);
                const timer = typingExpiryTimers.get(key);
                if (timer) clearTimeout(timer);
                typingExpiryTimers.delete(key);
                return;
            }

            const nextUser = { userId: update.userId, username: update.username, displayName: update.displayName };
            this.typingUsersByConversationId[update.conversationId] = existingIndex === -1
                ? [...users, nextUser]
                : users.map((item, index) => index === existingIndex ? nextUser : item);

            const existingTimer = typingExpiryTimers.get(key);
            if (existingTimer) clearTimeout(existingTimer);
            typingExpiryTimers.set(key, setTimeout(() => {
                const currentUsers = this.typingUsersByConversationId[update.conversationId] ?? [];
                this.typingUsersByConversationId[update.conversationId] = currentUsers.filter((item) => item.userId !== update.userId);
                typingExpiryTimers.delete(key);
            }, TYPING_TTL_MS));
        }
    }
});
