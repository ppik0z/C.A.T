<script setup lang="ts">
import { Phone, PhoneMissed, PhoneOutgoing, Video } from '@lucide/vue';
import { computed } from 'vue';
import type { CallKind } from '../../../types/call';
import type { ChatMessage } from '../../../types/chat';
import { formatMessageTime } from '../../../utils/chatPresentation';
import { getCallEventPresentation } from '../../../utils/callEventPresentation';

interface Props {
  message: ChatMessage;
  currentUserId: number | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  callBack: [kind: CallKind];
}>();

const presentation = computed(() => {
  return getCallEventPresentation(props.message, props.currentUserId);
});
</script>

<template>
  <article
    :class="[
      'flex w-[min(88vw,20rem)] items-center gap-3 rounded-[1.25rem] border p-3 shadow-sm',
      presentation.isMissed
        ? 'border-error/20 bg-error-container/35'
        : 'border-outline-variant/80 bg-surface-container-lowest',
    ]"
  >
    <span
      :class="[
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        presentation.isMissed
          ? 'bg-error-container text-error'
          : 'bg-primary-container text-primary',
      ]"
      aria-hidden="true"
    >
      <PhoneMissed v-if="presentation.isMissed" :size="20" />
      <Video v-else-if="presentation.kind === 'video'" :size="20" />
      <PhoneOutgoing v-else-if="presentation.isOutgoing" :size="20" />
      <Phone v-else :size="20" />
    </span>

    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-bold text-on-surface">
        {{ presentation.title }}
      </span>
      <span class="mt-0.5 block truncate text-xs text-on-surface-variant">
        {{ presentation.detail || formatMessageTime(props.message.createdAt) }}
      </span>
      <span
        v-if="presentation.detail"
        class="mt-0.5 block text-[11px] text-secondary"
      >
        {{ formatMessageTime(props.message.createdAt) }}
      </span>
    </span>

    <button
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      type="button"
      :aria-label="presentation.kind === 'video' ? 'Gọi lại bằng video' : 'Gọi lại bằng thoại'"
      :title="presentation.kind === 'video' ? 'Gọi video' : 'Gọi thoại'"
      @click="emit('callBack', presentation.kind)"
    >
      <Video v-if="presentation.kind === 'video'" :size="20" />
      <Phone v-else :size="20" />
    </button>
  </article>
</template>
