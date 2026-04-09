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
};