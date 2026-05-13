<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useChatStore } from '../../stores/chat';
import type { ChatMessage } from '../../types/chat';

const chatStore = useChatStore();
const scrollRef = ref<HTMLElement | null>(null);

const getSenderId = (message: ChatMessage) => message.senderId ?? message.sender?.id;

const sortedMessages = computed(() => {
  return [...chatStore.messages].sort((a, b) => a.id - b.id);
});

const isOwnMessage = (message: ChatMessage) => getSenderId(message) === chatStore.myId;

const getSenderName = (message: ChatMessage) => {
  return message.sender?.username ?? message.senderName ?? 'Unknown';
};

watch(
  () => chatStore.messages.length,
  async () => {
    await nextTick();
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
    }
  },
);
</script>

<template>
  <section ref="scrollRef" class="flex-1 overflow-y-auto p-6 flex flex-col gap-6 thin-scrollbar bg-background/50">
    <div class="flex justify-center">
      <span class="px-4 py-1 bg-tertiary-container/30 text-tertiary text-xs rounded-full font-semibold uppercase tracking-wider">
        Today
      </span>
    </div>

    <div
      v-for="msg in sortedMessages"
      :key="msg.id"
      :class="[
        'flex gap-4 max-w-[80%] animate-slide-in',
        isOwnMessage(msg) ? 'flex-row-reverse ml-auto' : 'mr-auto',
      ]"
    >
      <div
        v-if="!isOwnMessage(msg)"
        class="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-xs font-bold self-end shadow-sm shrink-0"
      >
        {{ getSenderName(msg)[0]?.toUpperCase() ?? 'U' }}
      </div>

      <div :class="['flex flex-col gap-1', isOwnMessage(msg) ? 'items-end' : 'items-start']">
        <div
          :class="[
            'p-4 shadow-sm',
            isOwnMessage(msg)
              ? 'bg-primary text-on-primary rounded-2xl rounded-br-none shadow-md'
              : 'bg-surface-container-highest text-on-surface-variant rounded-2xl rounded-bl-none',
          ]"
        >
          <p v-if="!isOwnMessage(msg)" class="text-[11px] font-semibold opacity-70 mb-1 uppercase tracking-wider">
            {{ getSenderName(msg) }}
          </p>
          <p class="text-base leading-6">{{ msg.content }}</p>
        </div>

        <div :class="['flex items-center gap-1 text-xs text-secondary', isOwnMessage(msg) ? 'flex-row-reverse' : '']">
          <span>Just now</span>
          <span v-if="isOwnMessage(msg)" class="material-symbols-outlined text-[16px] text-primary">done_all</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
</style>
