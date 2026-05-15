<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import IconButton from '../atoms/IconButton.vue';

const emit = defineEmits<{
  send: [content: string];
  typingStart: [];
  typingStop: [];
}>();

const text = ref('');
let typingStopTimer: ReturnType<typeof setTimeout> | null = null;

const clearTypingStopTimer = () => {
  if (!typingStopTimer) return;
  clearTimeout(typingStopTimer);
  typingStopTimer = null;
};

const handleSend = () => {
  const content = text.value.trim();
  if (!content) return;

  emit('send', content);
  text.value = '';
  clearTypingStopTimer();
  emit('typingStop');
};

watch(text, (value) => {
  clearTypingStopTimer();
  if (!value.trim()) {
    emit('typingStop');
    return;
  }

  emit('typingStart');
  typingStopTimer = setTimeout(() => {
    emit('typingStop');
    typingStopTimer = null;
  }, 1500);
});

onBeforeUnmount(() => {
  clearTypingStopTimer();
  emit('typingStop');
});
</script>

<template>
  <footer class="px-3 sm:px-6 py-3 sm:py-4 bg-surface-container-lowest border-t border-outline-variant">
    <div class="flex items-center gap-2 sm:gap-3">
      <IconButton class="hidden xs:flex" icon="add" label="Add attachment" />

      <div class="flex-1 flex items-center bg-surface-container-low border border-outline-variant rounded-full px-3 sm:px-4 py-1 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all min-w-0">
        <input
          v-model="text"
          class="flex-1 min-w-0 bg-transparent border-none focus:ring-0 focus:outline-none text-sm sm:text-base py-2 placeholder:text-outline"
          placeholder="Type your message..."
          type="text"
          @keyup.enter="handleSend"
        />
        <button class="hidden sm:flex w-8 h-8 items-center justify-center text-primary hover:bg-surface-container-highest rounded-full transition-colors shrink-0" type="button">
          <span class="material-symbols-outlined text-[24px]">sentiment_satisfied</span>
        </button>
      </div>

      <IconButton icon="send" label="Send message" @click="handleSend" />
    </div>

    <div class="flex justify-between items-center mt-2 px-2 sm:px-4">
      <div class="flex items-center gap-2 min-w-0">
        <div class="flex gap-[2px] shrink-0">
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></span>
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></span>
        </div>
        <span class="text-xs text-secondary truncate">Realtime connected</span>
      </div>
      <p class="text-xs text-secondary hidden md:block">Press Enter to send</p>
    </div>
  </footer>
</template>

<style scoped>
@media (min-width: 420px) {
  .xs\:flex {
    display: flex;
  }
}
</style>
