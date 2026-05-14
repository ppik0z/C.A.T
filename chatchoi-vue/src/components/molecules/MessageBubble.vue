<script setup lang="ts">
import type { ChatMessage } from '../../types/chat';

interface Props {
  message: ChatMessage;
  isOwn: boolean;
}

const props = defineProps<Props>();

const getSenderName = (message: ChatMessage) => {
  return message.sender?.username ?? message.senderName ?? 'Unknown';
};
</script>

<template>
  <div
    :class="[
      'flex gap-3 sm:gap-4 max-w-[min(82%,42rem)] animate-slide-in',
      props.isOwn ? 'flex-row-reverse ml-auto' : 'mr-auto',
    ]"
  >
    <div
      v-if="!props.isOwn"
      class="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-xs font-bold self-end shadow-sm shrink-0"
    >
      {{ getSenderName(props.message)[0]?.toUpperCase() ?? 'U' }}
    </div>

    <div :class="['flex flex-col gap-1 min-w-0', props.isOwn ? 'items-end' : 'items-start']">
      <div
        :class="[
          'p-3 sm:p-4 shadow-sm break-words',
          props.isOwn
            ? 'bg-primary text-on-primary rounded-2xl rounded-br-none shadow-md'
            : 'bg-surface-container-highest text-on-surface-variant rounded-2xl rounded-bl-none',
        ]"
      >
        <p v-if="!props.isOwn" class="text-[11px] font-semibold opacity-70 mb-1 uppercase tracking-wider">
          {{ getSenderName(props.message) }}
        </p>
        <p class="text-sm sm:text-base leading-6 whitespace-pre-wrap">{{ props.message.content }}</p>
      </div>

      <div :class="['flex items-center gap-1 text-xs text-secondary', props.isOwn ? 'flex-row-reverse' : '']">
        <span>Just now</span>
        <span v-if="props.isOwn" class="material-symbols-outlined text-[16px] text-primary">done_all</span>
      </div>
    </div>
  </div>
</template>
