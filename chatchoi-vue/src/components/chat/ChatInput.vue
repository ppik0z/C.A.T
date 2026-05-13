<script setup lang="ts">
import { ref } from 'vue';
import { useChatStore } from '../../stores/chat';

const chatStore = useChatStore();
const text = ref('');

const handleSend = () => {
  const content = text.value.trim();
  if (!content) return;

  chatStore.sendMessage(content);
  text.value = '';
};
</script>

<template>
  <footer class="px-6 py-4 bg-surface-container-lowest border-t border-outline-variant">
    <div class="flex items-center gap-3">
      <button
        class="w-10 h-10 flex items-center justify-center bg-primary-container/20 hover:bg-primary-container/40 text-primary rounded-full transition-colors shrink-0"
        type="button"
      >
        <span class="material-symbols-outlined text-[24px]">add</span>
      </button>

      <div class="flex-1 flex items-center bg-surface-container-low border border-outline-variant rounded-full px-4 py-1 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all min-w-[120px]">
        <input
          v-model="text"
          class="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-base py-2 placeholder:text-outline"
          placeholder="Type your message..."
          type="text"
          @keyup.enter="handleSend"
        />
        <button class="w-8 h-8 flex items-center justify-center text-primary hover:bg-surface-container-highest rounded-full transition-colors" type="button">
          <span class="material-symbols-outlined text-[24px]">sentiment_satisfied</span>
        </button>
      </div>

      <button
        class="w-10 h-10 flex items-center justify-center text-primary hover:bg-surface-container-high rounded-full transition-all active:scale-95 shrink-0"
        type="button"
        @click="handleSend"
      >
        <span class="material-symbols-outlined text-[28px]">send</span>
      </button>
    </div>

    <div class="flex justify-between items-center mt-2 px-4">
      <div class="flex items-center gap-2">
        <div class="flex gap-[2px]">
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></span>
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></span>
        </div>
        <span class="text-xs text-secondary">Realtime connected</span>
      </div>
      <p class="text-xs text-secondary hidden md:block">Press Enter to send</p>
    </div>
  </footer>
</template>
