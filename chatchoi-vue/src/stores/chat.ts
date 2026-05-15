import { defineStore } from 'pinia';
import { socket } from '../socket';
import { jwtDecode } from 'jwt-decode';
import { fetchConversationDetail } from '../services/conversation.service';
import type { ChatMessage, Conversation, ConversationDetailLoadState, ConversationListUpdate, JwtIdentity, MessageLoadState } from '../types/chat';

const PREFETCH_DELAY_MS = 250;
const CONVERSATION_DETAIL_TTL_MS = 60_000;

const delay = (milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
});

const appendUniqueMessage = (messages: ChatMessage[], message: ChatMessage) => {
    return messages.some((item) => item.id === message.id) ? messages : [...messages, message];
};

export const useChatStore = defineStore('chat', {
    state: () => ({
        messagesByConversationId: {} as Record<number, ChatMessage[]>,
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

        setMessagesForConversation(conversationId: number, msgs: ChatMessage[]) {
            this.messagesByConversationId[conversationId] = msgs;
            this.messageLoadStateByConversationId[conversationId] = 'loaded';
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

            socket.emit("send_message", {
                conversationId: this.currentConversationId,
                senderName: this.myUserName,
                content: content
            }, (response: ChatMessage) => {
                // Nhận phản hồi "savedMsg" từ Server và cập nhật UI 
                if (response && response.id) {
                    this.pushMessage(response);
                }
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
        }
    }
});
