<script setup lang="ts">
import { useChatStore } from '../../stores/chat';
const chatStore = useChatStore();

const handleLogout = () => {
  localStorage.removeItem('accessToken');
  window.location.reload();
};
</script>

<template>
  <nav class="w-20 bg-slate-100 dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-6 gap-6">
    <div class="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-bold shadow-lg cursor-pointer hover:scale-105 transition-transform">
      {{ chatStore.myId }}
    </div>

    <div class="flex-1 flex flex-col gap-4">
      <button class="p-3 text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all">
        💬
      </button>
      <button class="p-3 text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all">
        👥
      </button>
    </div>

    <button @click="handleLogout" title="Đăng xuất" class="p-3 text-slate-400 hover:text-red-500 transition-colors">
       🚪
    </button>
  </nav>
</template>