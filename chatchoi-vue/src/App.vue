<script setup lang="ts">
import { onMounted } from 'vue';
import Sidebar from './components/chat/Sidebar.vue';
import MessageList from './components/chat/MessageList.vue';
import ChatInput from './components/chat/ChatInput.vue';
import { initSocketService } from './services/socket.service';

onMounted(() => {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI5LCJ1c2VybmFtZSI6Im1lb19iZW8iLCJpYXQiOjE3NzU0NjM1MjAsImV4cCI6MTc3NjA2ODMyMH0.zdYhfBZAj_vGqZjHw_DYuT6wwsTi8eAciyTpFPJx1k0"; 
  if (token) {
    initSocketService(token);
  }
});
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden font-sans transition-colors duration-300">
    <Sidebar />
    
    <main class="flex-1 flex flex-col overflow-hidden">
      <header class="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark flex items-center px-6 transition-colors duration-300">
        <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">
          Phòng Chat Số 1
        </p>
      </header>
      
      <MessageList />
      <ChatInput />
    </main>
  </div>
</template>