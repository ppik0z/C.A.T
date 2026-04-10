import { socket } from "../socket";
import { useChatStore } from "../stores/chat";

export const initSocketService = (token: string) => {
    const chatStore = useChatStore();
    let heartbeatInterval: any;

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

    socket.on("load_messages_success", (msgs) => {
        chatStore.setMessages(msgs);
    });

    socket.on("new_message", (msg) => {
        chatStore.pushMessage(msg);
    });

    socket.on("disconnect", () => {
        chatStore.isConnected = false;
        if (heartbeatInterval) clearInterval(heartbeatInterval);
    });

    socket.on("initial_presence_sync", (data: { onlineUserIds: number[] }) => {
        chatStore.setUsersOnline(data.onlineUserIds);
    });

    socket.on("user_status_changed", (data: { userId: number, status: string }) => {
        console.log(`User ${data.userId} đang ${data.status}`);
        chatStore.updateUserStatus(data.userId, data.status);
    });
};