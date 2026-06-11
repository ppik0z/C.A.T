<script setup lang="ts">
import { computed } from 'vue';
import { Phone, PhoneCall, PhoneOff, Video } from '@lucide/vue';
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
  <div class="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[140] flex flex-col gap-3 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:w-[24rem]">
    <div
      v-for="call in incomingCalls"
      :key="call.id"
      class="rounded-[2rem] border border-outline-variant/80 bg-surface-container-lowest/95 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-3.5"
      role="status"
      aria-live="polite"
    >
      <div class="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <div class="relative shrink-0">
          <Avatar :avatar-url="call.startedBy.avatar" :name="call.startedBy.username" size="xl" class="sm:hidden" />
          <Avatar :avatar-url="call.startedBy.avatar" :name="call.startedBy.username" size="lg" class="hidden sm:inline-flex" />
          <span
            class="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary text-on-primary"
          >
            <Video v-if="call.kind === 'video'" class="h-3.5 w-3.5" aria-hidden="true" />
            <Phone v-else class="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-lg font-bold text-on-surface sm:text-sm">{{ resolveDisplayName(call.startedBy) }}</p>
          <p class="truncate text-sm text-on-surface-variant sm:text-xs">
            Gọi {{ call.kind === 'video' ? 'video' : 'thoại' }} trong {{ getConversationLabel(call.conversationId) }}
          </p>
        </div>
      </div>

      <div class="mt-5 flex items-center gap-3 sm:mt-4 sm:justify-end sm:gap-2">
        <button
          class="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-error px-4 text-sm font-bold text-on-error shadow-sm transition hover:bg-error/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 sm:h-11"
          type="button"
          aria-label="Từ chối cuộc gọi"
          @click="callStore.declineCall(call.id)"
        >
          <PhoneOff class="h-4 w-4" aria-hidden="true" />
          <span>Từ chối</span>
        </button>
        <button
          class="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-on-primary shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-11"
          type="button"
          aria-label="Chấp nhận cuộc gọi"
          @click="callStore.acceptCall(call.id)"
        >
          <PhoneCall class="h-4 w-4" aria-hidden="true" />
          <span>Chấp nhận</span>
        </button>
      </div>
    </div>
  </div>
</template>
