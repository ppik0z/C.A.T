import { socket } from "../socket";
import { useChatStore } from "../stores/chat";

export const initSocketService = (token: string) => {
    const chatStore = useChatStore();

    socket.auth = { token };
    socket.connect();

    socket.on("connect", () => {
        chatStore.isConnected = true;
        console.log("Đã kết nối!");

        // Join room và load tin nhắn cũ 
        socket.emit("join_room", { conversationId: chatStore.currentConversationId });
        socket.emit("load_messages", { conversationId: chatStore.currentConversationId });
    });

    socket.on("load_messages_success", (msgs) => {
        chatStore.setMessages(msgs);
    });

    socket.on("new_message", (msg) => {
        chatStore.pushMessage(msg);
    });

    socket.on("disconnect", () => {
        chatStore.isConnected = false;
    });
};