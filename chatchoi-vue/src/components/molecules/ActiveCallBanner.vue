<script setup lang="ts">
import { computed } from 'vue';
import { Phone, PhoneCall, PhoneOff, Video, Maximize2 } from '@lucide/vue';
import Avatar from '../atoms/Avatar.vue';
import { useCallStore } from '../../stores/call';
import type { Conversation } from '../../types/chat';
import { getConversationName, getConversationUser } from '../../utils/chatPresentation';
import { resolveDisplayName } from '../../utils/userPresentation';

interface Props {
  conversation: Conversation;
}

const props = defineProps<Props>();
const callStore = useCallStore();

const call = computed(() => callStore.getCallByConversationId(props.conversation.id));
const isVisible = computed(() => Boolean(call.value && ['ringing', 'active'].includes(call.value.status)));
const avatarUrl = computed(() => {
  return props.conversation.isGroup ? props.conversation.avatarGroup : getConversationUser(props.conversation)?.avatar;
});

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
  return `${resolveDisplayName(call.value.startedBy)} đã bắt đầu cuộc gọi ${kind}`;
});

const primaryActionLabel = computed(() => {
  if (!call.value) return '';
  if (call.value.currentUserStatus === 'joined') return 'Mở';
  if (call.value.currentUserStatus === 'ringing') return 'Nghe';
  return 'Tham gia';
});

const handlePrimaryAction = () => {
  if (!call.value) return;
  if (call.value.currentUserStatus === 'ringing') {
    callStore.acceptCall(call.value.id);
    return;
  }
  if (call.value.currentUserStatus === 'joined') {
    callStore.overlayCallId = call.value.id;
    callStore.isCallExpanded = true;
    return;
  }
  callStore.joinCall(call.value.id);
};
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 -translate-y-1 scale-95"
  >
    <div
      v-if="isVisible && call"
      class="pointer-events-none absolute inset-x-3 top-[4.75rem] z-20 sm:inset-x-auto sm:right-6 sm:w-[23rem]"
    >
      <section
        class="pointer-events-auto rounded-[1.75rem] border border-outline-variant/80 bg-surface-container-lowest/95 p-3 shadow-2xl shadow-black/15 backdrop-blur-xl"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-center gap-3">
          <div class="relative shrink-0">
            <Avatar :avatar-url="avatarUrl" :name="getConversationName(props.conversation)" size="lg" />
            <span
              class="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary text-on-primary"
            >
              <Video v-if="call.kind === 'video'" class="h-3.5 w-3.5" aria-hidden="true" />
              <Phone v-else class="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold text-on-surface">{{ title }}</p>
            <p class="truncate text-xs text-on-surface-variant">{{ description }}</p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <button
              v-if="call.currentUserStatus === 'ringing'"
              class="flex h-10 w-10 items-center justify-center rounded-full bg-error text-on-error shadow-sm transition hover:bg-error/90 focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2"
              type="button"
              aria-label="Từ chối cuộc gọi"
              @click="callStore.declineCall(call.id)"
            >
              <PhoneOff class="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              class="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-3.5 text-xs font-bold text-on-primary shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              type="button"
              :aria-label="primaryActionLabel"
              @click="handlePrimaryAction"
            >
              <PhoneCall v-if="call.currentUserStatus !== 'joined'" class="h-4 w-4" aria-hidden="true" />
              <Maximize2 v-else class="h-4 w-4" aria-hidden="true" />
              <span>{{ primaryActionLabel }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </Transition>
</template>
