import { defineStore } from 'pinia';
import { socket } from '../socket';

export const useChatStore = defineStore('chat', {
    state: () => ({
        messages: [] as any[],
        currentConversationId: 1, // Tạm thời mặc định phòng 1
        isConnected: false,
    }),

    actions: {
        // Đổ dữ liệu lịch sử vào
        setMessages(msgs: any[]) {
            this.messages = msgs;
        },

        // Thêm 1 tin nhắn mới (real-time hoặc vừa gửi)
        pushMessage(msg: any) {
            // Tránh trùng lặp nếu đã nhận từ callback gửi tin
            const exists = this.messages.find(m => m.id === msg.id);
            if (!exists) this.messages.push(msg);
        },

        // Hàm gửi tin nhắn đi
        sendMessage(content: string) {
            if (!content.trim()) return;

            socket.emit("send_message", {
                conversationId: this.currentConversationId,
                content: content
            }, (response: any) => {
                // Nhận phản hồi "savedMsg" từ Server và cập nhật UI ngay
                if (response && response.id) {
                    this.pushMessage(response);
                }
            });
        }
    }
});