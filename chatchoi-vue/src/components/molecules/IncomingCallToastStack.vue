<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import { useCallStore } from '../../stores/call';
import { useChatStore } from '../../stores/chat';
import { getConversationName } from '../../utils/chatPresentation';
import { resolveDisplayName } from '../../utils/userPresentation';

const callStore = useCallStore();
const chatStore = useChatStore();

const incomingCalls = computed(() => callStore.incomingCalls);

const getConversationLabel = (conversationId: number) => {
  const conversation = chatStore.conversations.find((item) => item.id === conversationId) ?? null;
  return getConversationName(conversation);
};
</script>

<template>
  <div class="fixed top-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
    <div
      v-for="call in incomingCalls"
      :key="call.id"
      class="rounded-lg border border-outline-variant bg-surface-container-lowest shadow-xl p-4"
      role="status"
      aria-live="polite"
    >
      <div class="flex gap-3">
        <Avatar :avatar-url="call.startedBy.avatar" :name="call.startedBy.username" size="lg" />
        <div class="min-w-0 flex-1">
          <p class="font-bold text-on-surface truncate">{{ resolveDisplayName(call.startedBy) }}</p>
          <p class="text-sm text-on-surface-variant truncate">
            Gọi {{ call.kind === 'video' ? 'video' : 'thoại' }} trong {{ getConversationLabel(call.conversationId) }}
          </p>
        </div>
        <span class="material-symbols-outlined text-primary text-[24px]">
          {{ call.kind === 'video' ? 'videocam' : 'call' }}
        </span>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button
          class="h-10 rounded-full bg-error text-on-error text-sm font-bold hover:bg-error/90 focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2"
          type="button"
          @click="callStore.declineCall(call.id)"
        >
          Từ chối
        </button>
        <button
          class="h-10 rounded-full bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          type="button"
          @click="callStore.acceptCall(call.id)"
        >
          Chấp nhận
        </button>
      </div>
    </div>
  </div>
</template>
