<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useChatStore } from '../../stores/chat';
import { socket } from '../../socket';

const chatStore = useChatStore();
const conversations = computed(() => chatStore.conversations);

onMounted(async () => {
  const token = localStorage.getItem('accessToken');
  if (!token) return;

  try {
    const res = await fetch('http://localhost:3000/conversations', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    chatStore.setConversations(data);
  } catch (error) {
    console.error('Lỗi lấy danh sách phòng:', error);
  }
});

const handleSelectConv = (convId: number) => {
    chatStore.currentConversationId = convId;
    const currentConv = chatStore.conversations.find(c => c.id === convId);
    
    // Sử dụng lastMessageIndex để markAsRead (chuẩn theo logic Backend bồ đã viết)
    const latestIndex = currentConv?.lastMessageIndex || 0; 
    
    if (latestIndex > 0) {
        chatStore.markAsRead(convId, latestIndex);
    } else {
        chatStore.clearUnread(convId);
    }

    socket.emit("join_room", { conversationId: convId });
    socket.emit("load_messages", { conversationId: convId });
};
</script>

<template>
  <aside class="w-80 bg-white dark:bg-bg-dark border-r border-slate-100 dark:border-slate-800 flex flex-col">
    <div class="h-16 flex items-center px-6 border-b border-slate-50 dark:border-slate-800/50">
      <h2 class="font-bold text-xl text-primary tracking-tight">CHATCHOI</h2>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-2">
      <p class="text-[10px] font-bold text-slate-400 uppercase px-2 mb-2">Đoạn chat</p>
      
      <div v-for="conv in conversations" :key="conv.id"
           @click="handleSelectConv(conv.id)"
           :class="['p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 relative group', 
                    chatStore.currentConversationId === conv.id 
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-100 dark:ring-blue-800' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50']">
        
        <div class="relative shrink-0">
          <div class="w-12 h-12 rounded-full bg-linear-to-tr from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center overflow-hidden shadow-sm">
            <span class="text-sm font-bold text-slate-500 dark:text-slate-300 uppercase">
              {{ conv.isGroup ? conv.name?.[0] : conv.friend?.username?.[0] }}
            </span>
          </div>
          <span v-if="conv.isOnline" 
                class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-bg-dark rounded-full">
          </span>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex justify-between items-baseline mb-0.5">
            <p :class="['text-sm truncate mr-2', 
                        conv.unreadCount > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-200']">
              {{ conv.isGroup ? conv.name : conv.friend?.username }}
            </p>
          </div>
          
          <div class="flex items-center justify-between">
            <p :class="['text-xs truncate flex-1', 
                        conv.unreadCount > 0 ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400']">
              <span v-if="conv.lastMessage?.content">
                {{ conv.lastMessage.senderName === chatStore.myUserName ? 'Bạn' : conv.lastMessage.senderName }}: {{ conv.lastMessage.content }}
              </span>
              <span v-else class="italic">Chưa có tin nhắn nào...</span>
            </p>

            <div v-if="conv.unreadCount > 0" 
                 class="ml-2 px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] flex justify-center items-center shadow-sm">
              {{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}
            </div>
            
            <div v-if="conv.unreadCount > 0" class="w-2 h-2 bg-primary rounded-full ml-1"></div>
          </div>
        </div>

      </div>
    </div>
  </aside>
</template>

<style scoped>
.group:hover .shadow-sm {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}
</style>