import { socket } from "../socket";
import { useChatStore } from "../stores/chat";
import { useFriendsStore } from "../stores/friends";
import type { ChatMessage, ConversationListUpdate, LoadMessagesSuccessPayload } from "../types/chat";

export const initSocketService = (token: string) => {
    const chatStore = useChatStore();
    const friendsStore = useFriendsStore();
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    socket.auth = { token };
    socket.connect();

    socket.on("connect", () => {
        chatStore.isConnected = true;
        console.log("Đã kết nối!");

        // Heartbeat, interval 15s
        heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit("heartbeat");
            }
        }, 15000);

    });

    socket.on("load_messages_success", (payload: LoadMessagesSuccessPayload) => {
        chatStore.setMessagesForConversation(payload.conversationId, payload.messages);
    });

    socket.on("new_message", (msg: ChatMessage) => {
        chatStore.pushMessage(msg);

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

    const refreshFriends = () => {
        void friendsStore.refreshAll();
    };

    socket.on("friend_request_received", refreshFriends);
    socket.on("friend_request_cancelled", refreshFriends);
    socket.on("friend_request_accepted", refreshFriends);
    socket.on("friend_request_rejected", refreshFriends);
    socket.on("friend_removed", refreshFriends);
};
