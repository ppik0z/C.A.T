<script setup lang="ts">
import { ref } from 'vue';
import { useChatStore } from '../../stores/chat';

const chatStore = useChatStore();
const isDark = ref(false);

const handleLogout = () => {
  localStorage.removeItem('accessToken'); 
  window.location.reload(); 
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};
</script>

<template>
  <aside class="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark flex flex-col transition-colors duration-300">
    <div class="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
      <h2 class="font-bold text-xl tracking-tight text-primary">CHATCHOI</h2>
    </div>
    
    <div class="flex-1 p-4 space-y-2">
      <p class="text-[10px] font-bold text-slate-400 uppercase px-2 mb-2">Channels</p>
      <div :class="['p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3', 
                    chatStore.currentConversationId === 1 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-primary font-semibold' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800']">
        <span class="text-lg">#</span>
        <span class="text-sm">Phòng Số 1</span>
      </div>
    </div>

    <div class="p-4 border-t border-slate-100 dark:border-slate-800">
      <button @click="toggleTheme" 
              class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:opacity-80 transition-all">
        <span class="text-xs font-medium">{{ isDark ? 'Dark Mode' : 'Light Mode' }}</span>
        <span>{{ isDark ? '🌙' : '☀️' }}</span>
      </button>

      <button @click="handleLogout" 
              class="w-full mt-2 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-95 transition-all">
        Đăng Xuất
      </button>
    </div>
  </aside>
</template>