<script setup lang="ts">
import { ref } from 'vue';
import { useChatStore } from '../../stores/chat';

const chatStore = useChatStore();
const text = ref('');

const handleSend = () => {
  if (!text.value.trim()) return;
  chatStore.sendMessage(text.value);
  text.value = '';
};
</script>

<template>
  <footer class="p-6 bg-white dark:bg-surface-dark border-t border-slate-100 dark:border-slate-800">
    <div class="max-w-4xl mx-auto flex items-center gap-3 bg-bg-light dark:bg-bg-dark p-2 rounded-2xl shadow-inner">
      <input 
        v-model="text"
        @keyup.enter="handleSend"
        placeholder="Viết tin nhắn..."
        class="flex-1 bg-transparent px-4 py-2 focus:outline-none text-slate-700 dark:text-slate-200"
      />
      <button @click="handleSend" 
              class="bg-primary hover:bg-blue-600 text-white p-3 rounded-xl transition-all active:scale-95 shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
      </button>
    </div>
  </footer>
</template>