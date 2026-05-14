<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import ChatHeader from '../molecules/ChatHeader.vue';
import ComposerBar from '../molecules/ComposerBar.vue';
import MessageBubble from '../molecules/MessageBubble.vue';
import { useChatStore } from '../../stores/chat';
import type { ChatMessage, Conversation } from '../../types/chat';

interface Props {
  conversation: Conversation | null;
  detailsOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  back: [];
  toggleDetails: [];
}>();

const chatStore = useChatStore();
const scrollRef = ref<HTMLElement | null>(null);

const sortedMessages = computed(() => {
  return [...chatStore.currentMessages].sort((a, b) => a.id - b.id);
});

const getSenderId = (message: ChatMessage) => message.senderId ?? message.sender?.id;
const isOwnMessage = (message: ChatMessage) => getSenderId(message) === chatStore.myId;

watch(
  () => chatStore.currentMessages.length,
  async () => {
    await nextTick();
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
    }
  },
);
</script>

<template>
  <section class="h-full min-w-0 flex flex-col bg-surface overflow-hidden relative">
    <template v-if="props.conversation">
      <ChatHeader
        :conversation="props.conversation"
        :details-open="props.detailsOpen"
        @back="emit('back')"
        @toggle-details="emit('toggleDetails')"
      />

      <div ref="scrollRef" class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 sm:gap-6 thin-scrollbar bg-background/50">
        <div class="flex justify-center">
          <span class="px-4 py-1 bg-tertiary-container/30 text-tertiary text-xs rounded-full font-semibold uppercase tracking-wider">
            Today
          </span>
        </div>

        <MessageBubble
          v-for="message in sortedMessages"
          :key="message.id"
          :is-own="isOwnMessage(message)"
          :message="message"
        />
      </div>

      <ComposerBar @send="chatStore.sendMessage" />
    </template>

    <div v-else class="flex-1 flex flex-col items-center justify-center text-on-surface-variant bg-background/50 px-6 text-center">
      <div class="w-20 h-20 rounded-full bg-primary-container text-primary flex items-center justify-center mb-4">
        <span class="material-symbols-outlined text-[40px]">chat</span>
      </div>
      <h2 class="text-xl font-bold mb-2 text-on-surface">Chào mừng</h2>
      <p class="text-sm">Hãy chọn một đoạn chat để bắt đầu gửi tin nhắn</p>
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

:deep(.animate-slide-in) {
  animation: slide-in 0.3s ease-out;
}
</style>
