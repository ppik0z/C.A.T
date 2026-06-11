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
  <div class="fixed inset-x-3 top-3 z-50 flex flex-col gap-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[24rem]">
    <div
      v-for="call in incomingCalls"
      :key="call.id"
      class="rounded-[2rem] border border-outline-variant/80 bg-surface-container-lowest/95 p-3.5 shadow-2xl shadow-black/15 backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-center gap-3">
        <div class="relative shrink-0">
          <Avatar :avatar-url="call.startedBy.avatar" :name="call.startedBy.username" size="lg" />
          <span
            class="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary text-on-primary"
          >
            <Video v-if="call.kind === 'video'" class="h-3.5 w-3.5" aria-hidden="true" />
            <Phone v-else class="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold text-on-surface">{{ resolveDisplayName(call.startedBy) }}</p>
          <p class="truncate text-xs text-on-surface-variant">
            Gọi {{ call.kind === 'video' ? 'video' : 'thoại' }} trong {{ getConversationLabel(call.conversationId) }}
          </p>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-end gap-2">
        <button
          class="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-error px-4 text-sm font-bold text-on-error shadow-sm transition hover:bg-error/90 focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2"
          type="button"
          aria-label="Từ chối cuộc gọi"
          @click="callStore.declineCall(call.id)"
        >
          <PhoneOff class="h-4 w-4" aria-hidden="true" />
          <span>Từ chối</span>
        </button>
        <button
          class="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-on-primary shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
