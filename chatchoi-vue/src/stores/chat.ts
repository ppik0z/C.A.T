import { defineStore } from 'pinia';
import { socket } from '../socket';
import { jwtDecode } from 'jwt-decode';
import { fetchConversationDetail } from '../services/conversation.service';
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
    MessageStatusSnapshot,
    MessageStatusUpdate,
    ReadStateUpdate,
    TypingStateUpdate,
    TypingUser,
} from '../types/chat';

const PREFETCH_DELAY_MS = 250;
const CONVERSATION_DETAIL_TTL_MS = 60_000;
const TYPING_TTL_MS = 7_000;
const TYPING_REFRESH_MS = 2_000;
const typingExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

const delay = (milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
});

const appendUniqueMessage = (messages: ChatMessage[], message: ChatMessage): ChatMessage[] => {
    if (message.clientTempId) {
        const tempIndex = messages.findIndex((item) => item.clientTempId === message.clientTempId);
        if (tempIndex !== -1) {
            return messages.map((item, index) => index === tempIndex ? { ...message, localStatus: 'sent' as const } : item);
        }
    }

    return messages.some((item) => item.id === message.id) ? messages : [...messages, message];
};

const getTypingKey = (conversationId: number, userId: number) => `${conversationId}:${userId}`;

const resolveLocalMessageType = (file: File): ChatMessageType => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
};

export const useChatStore = defineStore('chat', {
    state: () => ({
        messagesByConversationId: {} as Record<number, ChatMessage[]>,
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
        myId: null as number | null,
        isConnected: false,
        conversations: [] as Conversation[],
        myUserName: null as string | null,
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
                this.myUserName = decoded.username;
                console.log("Định danh thành công, ID: ", this.myId);
            } catch (error) {
                console.error("Token lỏ!");
            }
        },

        setMessagesForConversation(
            conversationId: number,
            msgs: ChatMessage[],
            statuses: MessageStatusSnapshot[] = [],
            readStates: MemberReadState[] = [],
        ) {
            this.messagesByConversationId[conversationId] = msgs;
            this.setMessageStatuses(statuses);
            this.memberReadStatesByConversationId[conversationId] = readStates;
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

        requestMessagesForConversation(conversationId: number, limit = 20) {
            const loadState = this.messageLoadStateByConversationId[conversationId] ?? 'idle';
            if (loadState === 'loading' || loadState === 'loaded') return;

            this.messageLoadStateByConversationId[conversationId] = 'loading';
            socket.emit('load_messages', { conversationId, limit });
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
        sendMessage(content: string) {
            if (!content.trim() || !this.currentConversationId || !this.myUserName) return;

            const clientTempId = crypto.randomUUID();
            const optimisticMessage: ChatMessage = {
                id: -Date.now(),
                clientTempId,
                conversationId: this.currentConversationId,
                type: 'text',
                content: content.trim(),
                createdAt: new Date(),
                senderId: this.myId ?? undefined,
                senderName: this.myUserName,
                sender: this.myId ? { id: this.myId, username: this.myUserName } : undefined,
                localStatus: 'sending',
            };

            this.pushMessage(optimisticMessage);
            this.stopTyping(this.currentConversationId);

            socket.emit("send_message", {
                conversationId: this.currentConversationId,
                senderName: this.myUserName,
                type: 'text',
                content: content.trim(),
                clientTempId,
            }, (response: ChatMessage) => {
                // Nhận phản hồi "savedMsg" từ Server và cập nhật UI 
                if (response && response.id) {
                    this.pushMessage(response);
                }
            });
        },

        async sendMediaMessage(file: File, caption = '') {
            if (!this.currentConversationId || !this.myUserName) return;

            const token = localStorage.getItem('accessToken');
            if (!token) throw new Error('Bạn cần đăng nhập để gửi file.');

            const clientTempId = crypto.randomUUID();
            const conversationId = this.currentConversationId;
            const optimisticMessage: ChatMessage = {
                id: -Date.now(),
                clientTempId,
                conversationId,
                type: resolveLocalMessageType(file),
                content: caption.trim(),
                createdAt: new Date(),
                fileUrl: URL.createObjectURL(file),
                fileName: file.name,
                fileMimeType: file.type,
                fileSizeBytes: file.size,
                senderId: this.myId ?? undefined,
                senderName: this.myUserName,
                sender: this.myId ? { id: this.myId, username: this.myUserName } : undefined,
                localStatus: 'sending',
            };

            this.pushMessage(optimisticMessage);
            this.stopTyping(conversationId);

            try {
                const response = await uploadMediaMessage(token, {
                    conversationId,
                    file,
                    caption: caption.trim(),
                    clientTempId,
                });
                this.pushMessage(response);
            } catch (error) {
                this.markLocalMessageFailed(conversationId, clientTempId);
                console.error(error);
            }
        },

        sendGifMessage(gifUrl: string, caption = '') {
            if (!gifUrl.trim() || !this.currentConversationId || !this.myUserName) return;

            const clientTempId = crypto.randomUUID();
            const optimisticMessage: ChatMessage = {
                id: -Date.now(),
                clientTempId,
                conversationId: this.currentConversationId,
                type: 'gif',
                content: caption.trim(),
                createdAt: new Date(),
                fileUrl: gifUrl.trim(),
                senderId: this.myId ?? undefined,
                senderName: this.myUserName,
                sender: this.myId ? { id: this.myId, username: this.myUserName } : undefined,
                localStatus: 'sending',
            };

            this.pushMessage(optimisticMessage);
            this.stopTyping(this.currentConversationId);

            socket.emit("send_message", {
                conversationId: this.currentConversationId,
                senderName: this.myUserName,
                type: 'gif',
                content: caption.trim(),
                fileUrl: gifUrl.trim(),
                clientTempId,
            }, (response: ChatMessage) => {
                if (response && response.id) {
                    this.pushMessage(response);
                }
            });
        },

        markLocalMessageFailed(conversationId: number, clientTempId: string) {
            const messages = this.messagesByConversationId[conversationId] ?? [];
            this.messagesByConversationId[conversationId] = messages.map((message) => {
                return message.clientTempId === clientTempId
                    ? { ...message, localStatus: 'failed' as const }
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

            const token = localStorage.getItem('accessToken');
            if (!token) throw new Error('Bạn cần đăng nhập để tải thông tin đoạn chat.');

            this.conversationDetailLoadStateById[conversationId] = 'loading';
            const request = fetchConversationDetail(token, conversationId)
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
                conv.lastMessageContent = (data.senderName === 'Bạn' ? 'Bạn: ' : `${data.senderName}: `) + data.lastMessageContent;
                conv.lastMessage = {
                    id: data.lastMessageId,
                    content: data.lastMessageContent,
                    senderName: data.senderName,
                };
                conv.lastMessageIndex = data.lastMessageIndex;

                if (this.currentConversationId !== data.conversationId) {
                    conv.unreadCount = (conv.unreadCount || 0) + 1;
                } else {
                    this.markAsRead(data.conversationId, data.lastMessageIndex);
                }

                // Đẩy lên Top
                this.conversations.splice(index, 1);
                this.conversations.unshift(conv);
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

            const nextUser = { userId: update.userId, username: update.username };
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
