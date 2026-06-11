<script setup lang="ts">
import { Phone, PhoneMissed, PhoneOutgoing, Video } from '@lucide/vue';
import { computed } from 'vue';
import type { CallKind } from '../../../types/call';
import type { ChatMessage } from '../../../types/chat';
import { formatMessageTime } from '../../../utils/chatPresentation';
import { getCallEventPresentation } from '../../../utils/callEventPresentation';
import { resolveDisplayName } from '../../../utils/userPresentation';
import Avatar from '../../atoms/Avatar.vue';

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
const callerName = computed(() => {
  if (presentation.value.isOutgoing) return 'Bạn';
  const resolved = resolveDisplayName(props.message.sender);
  return resolved !== 'Unknown'
    ? resolved
    : props.message.senderName || 'Người gọi';
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
    <span class="relative shrink-0">
      <Avatar
        :avatar-url="props.message.sender?.avatar"
        :name="callerName"
        size="lg"
      />
      <span
        :class="[
          'absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-container-lowest',
          presentation.isMissed
            ? 'bg-error text-on-error'
            : 'bg-primary text-on-primary',
        ]"
        aria-hidden="true"
      >
        <PhoneMissed v-if="presentation.isMissed" :size="12" />
        <Video v-else-if="presentation.kind === 'video'" :size="12" />
        <PhoneOutgoing v-else-if="presentation.isOutgoing" :size="12" />
        <Phone v-else :size="12" />
      </span>
    </span>

    <span class="min-w-0 flex-1">
      <span class="block truncate text-xs font-semibold text-on-surface-variant">
        {{ callerName }}
      </span>
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
