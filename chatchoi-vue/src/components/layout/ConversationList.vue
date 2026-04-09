<script setup lang="ts">
import { useChatStore } from '../../stores/chat';
const chatStore = useChatStore();

// Giả lập danh sách - Sau này sẽ fetch từ API /conversations
const mockConvs = [
  { id: 1, name: 'Phòng Số 1', lastMsg: 'Alo...' },
  { id: 2, name: 'Cat Club', lastMsg: 'Miau miau' }
];
</script>

<template>
  <aside class="w-80 bg-white dark:bg-bg-dark border-r border-slate-100 dark:border-slate-800 flex flex-col">
    <div class="h-16 flex items-center px-6 border-b border-slate-50 dark:border-slate-800/50">
      <h2 class="font-bold text-xl text-primary tracking-tight">CHATCHOI</h2>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-2">
      <p class="text-[10px] font-bold text-slate-400 uppercase px-2 mb-2">Đoạn chat</p>
      
      <div v-for="conv in mockConvs" :key="conv.id"
           :class="['p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3', 
                    chatStore.currentConversationId === conv.id 
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-100 dark:ring-blue-800' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50']">
        <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"></div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{{ conv.name }}</p>
          <p class="text-xs text-slate-400 truncate">{{ conv.lastMsg }}</p>
        </div>
      </div>
    </div>
  </aside>
</template>