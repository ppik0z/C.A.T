import { socket } from "../socket";
import { useCallStore } from "../stores/call";
import { useChatStore } from "../stores/chat";
import { useFriendsStore } from "../stores/friends";
import { useProfilesStore } from "../stores/profiles";
import { useAccountStore } from "../stores/account";
import type { PublicUserProfile } from "../types/account";
import type { ActiveCallsPayload, CallErrorPayload, CallState } from "../types/call";
import type {
    ChatMessage,
    Conversation,
    ConversationListUpdate,
    LoadMessagesSuccessPayload,
    MessageSearchResult,
    MessageStatusUpdate,
    ReadStateUpdate,
    TypingStateUpdate,
} from "../types/chat";

let listenersRegistered = false;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export const connectSocket = (token: string) => {
    registerSocketListeners();
    socket.auth = { token };
    if (socket.connected) {
        socket.disconnect();
    }
    socket.connect();
};

export const disconnectSocket = () => {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    socket.disconnect();
};

export const initSocketService = connectSocket;

const registerSocketListeners = () => {
    if (listenersRegistered) return;
    listenersRegistered = true;
    const chatStore = useChatStore();
    const callStore = useCallStore();
    const friendsStore = useFriendsStore();
    const profilesStore = useProfilesStore();
    const accountStore = useAccountStore();
    socket.on("connect", () => {
        chatStore.isConnected = true;
        console.log("Đã kết nối!");

        // Heartbeat, interval 15s
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit("heartbeat");
            }
        }, 15000);

        callStore.syncActiveCalls();
    });

    socket.on("load_messages_success", (payload: LoadMessagesSuccessPayload) => {
        chatStore.handleMessagesLoaded(
            payload.conversationId,
            payload.messages,
            payload.messageStatuses ?? [],
            payload.memberReadStates ?? [],
            payload.pageInfo,
        );
    });

    socket.on("search_messages_success", (payload: { conversationId: number; keyword: string; results: MessageSearchResult[] }) => {
        chatStore.applySearchResults(payload.conversationId, payload.keyword, payload.results);
    });

    socket.on("search_messages_error", (payload: { conversationId: number; message: string }) => {
        chatStore.setSearchError(payload.conversationId, payload.message);
    });

    socket.on("new_message", (msg: ChatMessage) => {
        chatStore.pushMessage(msg);

        const senderId = msg.senderId ?? msg.sender?.id;
        if (senderId !== chatStore.myId && msg.conversationId && msg.id > 0) {
            socket.emit('message_delivered', {
                conversationId: msg.conversationId,
                messageId: msg.id,
            });
        }

        if (chatStore.currentConversationId === msg.conversationId) {
            chatStore.markAsRead(msg.conversationId, msg.conversationIndex ?? 0);
        }
    });

    socket.on("disconnect", () => {
        chatStore.isConnected = false;
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    });

    socket.on("initial_presence_sync", (data: { onlineUserIds: number[] }) => {
        chatStore.setUsersOnline(data.onlineUserIds);
    });

    socket.on("user_status_changed", (data: { userId: number, status: string }) => {
        console.log(`User ${data.userId} đang ${data.status}`);
        chatStore.updateUserStatus(data.userId, data.status);
    });

    socket.on("user_profile_updated", (profile: PublicUserProfile) => {
        profilesStore.applyProfile(profile);
        chatStore.applyUserProfileUpdate(profile);
        friendsStore.applyUserProfileUpdate(profile);
        if (profile.id === chatStore.myId) {
            void accountStore.fetchAccount();
        }
    });

    socket.on("update_conversation_list", (data: ConversationListUpdate) => {
        chatStore.updateConversationList({
            ...data,
            senderName: data.senderName === chatStore.myUserName ? 'Bạn' : data.senderName,
        });
    });

    socket.on("sync_read_state", (data: { conversationId: number, lastMessageIndex: number }) => {
        const conv = chatStore.conversations.find(c => c.id === data.conversationId);
        if (conv) {
            conv.unreadCount = 0;
            conv.lastSeenMessageIndex = data.lastMessageIndex;
        }
    });

    socket.on("message_status_updated", (data: MessageStatusUpdate) => {
        chatStore.applyMessageStatusUpdate(data);
    });

    socket.on("read_state_updated", (data: ReadStateUpdate) => {
        chatStore.applyReadStateUpdate(data);
    });

    socket.on("typing_state_changed", (data: TypingStateUpdate) => {
        chatStore.applyTypingState(data);
    });

    socket.on("call:active_sync", (data: ActiveCallsPayload) => {
        callStore.applyActiveSync(data.calls);
    });

    socket.on("call:ringing", (data: CallState) => {
        callStore.applyRinging(data);
    });

    socket.on("call:state_updated", (data: CallState) => {
        callStore.applyCallState(data);
    });

    socket.on("call:ended", (data: CallState) => {
        callStore.applyCallEnded(data);
    });

    socket.on("call:error", (data: CallErrorPayload) => {
        callStore.setCallError(data.message);
    });

    socket.on("conversation_upsert", (conversation: Conversation) => {
        chatStore.upsertConversation(conversation);
    });

    socket.on("conversation_removed", (data: { conversationId: number }) => {
        chatStore.removeConversation(data.conversationId);
    });

    const refreshFriends = () => {
        void friendsStore.refreshAll();
    };

    socket.on("friend_request_received", refreshFriends);
    socket.on("friend_request_cancelled", refreshFriends);
    socket.on("friend_request_accepted", refreshFriends);
    socket.on("friend_request_rejected", refreshFriends);
    socket.on("friend_removed", refreshFriends);
};
