import { defineStore } from 'pinia';
import { socket } from '../socket';
import { jwtDecode } from 'jwt-decode';

export const useChatStore = defineStore('chat', {
    state: () => ({
        messages: [] as any[],
        currentConversationId: null as number | null,
        myId: null as number | null,
        isConnected: false,
        conversations: [] as any[],
        myUserName: null as string | null,
    }),

    actions: {
        setIdentity(token: string) {
            try {
                const decoded: any = jwtDecode(token);
                this.myId = decoded.userId; // Lấy userId từ Token
                this.myUserName = decoded.username;
                console.log("Định danh thành công, ID: ", this.myId);
            } catch (error) {
                console.error("Token lỏ!");
            }
        },

        // Đổ dữ liệu lịch sử vào
        setMessages(msgs: any[]) {
            this.messages = msgs;
        },

        // Thêm 1 tin nhắn mới 
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
                // Nhận phản hồi "savedMsg" từ Server và cập nhật UI 
                if (response && response.id) {
                    this.pushMessage(response);
                }
            });
        },

        setConversations(convs: any[]) {
            this.conversations = convs;
        },

        // Set online khi vừa connect
        setUsersOnline(userIds: number[]) {
            this.conversations.forEach(conv => {
                if (!conv.isGroup && conv.friend && userIds.includes(conv.friend.id)) {
                    conv.isOnline = true;
                }
            });
        },

        // Cập nhật từng người khi nhận thông báo
        updateUserStatus(userId: number, status: string) {
            const conv = this.conversations.find(c => !c.isGroup && c.friend?.id === userId);
            if (conv) {
                conv.isOnline = (status === 'online');
            }
        },

        // Cập nhật ConversationList
        updateConversationList(data: { conversationId: number, lastMessage: string, senderName: string }) {
            const index = this.conversations.findIndex(c => c.id === data.conversationId);

            if (index !== -1) {
                // Cập nhật tin nhắn mới nhất
                // Nếu người gửi là mình thì hiện "Bạn: ...", không thì hiện "Tên: ..."
                const prefix = data.senderName === 'Bạn' ? 'Bạn: ' : `${data.senderName}: `;
                this.conversations[index].lastMessage = prefix + data.lastMessage;

                // Đẩy lên Top
                const [conv] = this.conversations.splice(index, 1);
                this.conversations.unshift(conv);
            }
        }
    }
});