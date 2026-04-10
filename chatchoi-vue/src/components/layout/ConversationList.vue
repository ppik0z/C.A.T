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
           :class="['p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3', 
                    chatStore.currentConversationId === conv.id 
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-100 dark:ring-blue-800' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50']">
        
        <div class="relative shrink-0">
          <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
            <span class="text-sm font-bold text-slate-500 uppercase">
              {{ conv.isGroup ? conv.name?.[0] : conv.friend?.username?.[0] }}
            </span>
          </div>
          <span v-if="conv.isOnline" 
                class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-surface-dark rounded-full">
          </span>
        </div>

        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
            {{ conv.isGroup ? conv.name : conv.friend?.username }}
          </p>
          <p class="text-xs text-slate-400 truncate">
            {{ conv.lastMessage ? conv.lastMessage : 'Chưa có tin nhắn nào...' }}
          </p>
        </div>
      </div>

    </div>
  </aside>
</template>