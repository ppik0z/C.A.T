<script setup lang="ts">
import { computed } from 'vue';
import { useCallStore } from '../../stores/call';
import type { Conversation } from '../../types/chat';
import { getConversationName } from '../../utils/chatPresentation';

interface Props {
  conversation: Conversation;
}

const props = defineProps<Props>();
const callStore = useCallStore();

const call = computed(() => callStore.getCallByConversationId(props.conversation.id));
const isVisible = computed(() => Boolean(call.value && ['ringing', 'active'].includes(call.value.status)));

const title = computed(() => {
  if (!call.value) return '';
  if (call.value.currentUserStatus === 'ringing') return 'Bạn có cuộc gọi đến';
  if (call.value.status === 'ringing') return 'Đang gọi';
  return 'Cuộc gọi đang diễn ra';
});

const description = computed(() => {
  if (!call.value) return '';
  const kind = call.value.kind === 'video' ? 'video' : 'thoại';
  const count = call.value.activeParticipantCount;
  if (count > 0) return `${count} người trong cuộc gọi ${kind}`;
  return `${call.value.startedBy.username} đã bắt đầu cuộc gọi ${kind}`;
});

const handlePrimaryAction = () => {
  if (!call.value) return;
  if (call.value.currentUserStatus === 'ringing') {
    callStore.acceptCall(call.value.id);
    return;
  }
  if (call.value.currentUserStatus === 'joined') {
    callStore.overlayCallId = call.value.id;
    return;
  }
  callStore.joinCall(call.value.id);
};
</script>

<template>
  <div
    v-if="isVisible && call"
    class="px-4 sm:px-6 py-3 bg-primary-container/55 border-b border-outline-variant flex items-center gap-3"
  >
    <div class="h-10 w-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
      <span class="material-symbols-outlined text-[22px]">{{ call.kind === 'video' ? 'videocam' : 'call' }}</span>
    </div>

    <div class="min-w-0 flex-1">
      <p class="text-sm font-bold text-on-surface truncate">{{ title }} · {{ getConversationName(props.conversation) }}</p>
      <p class="text-xs text-on-surface-variant truncate">{{ description }}</p>
    </div>

    <div class="flex items-center gap-2">
      <button
        v-if="call.currentUserStatus === 'ringing'"
        class="hidden sm:inline-flex h-9 px-3 rounded-full text-xs font-semibold text-error hover:bg-error-container"
        type="button"
        @click="callStore.declineCall(call.id)"
      >
        Từ chối
      </button>
      <button
        class="h-9 px-4 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        type="button"
        @click="handlePrimaryAction"
      >
        <template v-if="call.currentUserStatus === 'joined'">Mở</template>
        <template v-else>Tham gia</template>
      </button>
    </div>
  </div>
</template>
