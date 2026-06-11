<script setup lang="ts">
import { computed } from 'vue';
import type { ChatMessage } from '../../../types/chat';
import DocumentMessageContent from './DocumentMessageContent.vue';
import ImageMessageContent from './ImageMessageContent.vue';
import VideoMessageContent from './VideoMessageContent.vue';

interface Props {
  message: ChatMessage;
  isOwn: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  openMedia: [kind: 'image' | 'video'];
}>();
const messageType = computed(() => props.message.type ?? 'text');
const isStandaloneContent = computed(() => {
  return ['image', 'gif', 'video', 'document'].includes(messageType.value);
});
</script>

<template>
  <p v-if="props.message.recalledAt" class="text-sm italic opacity-75">
    Tin nhắn đã được thu hồi
  </p>

  <ImageMessageContent
    v-else-if="messageType === 'image' || messageType === 'gif'"
    :message="props.message"
    @open="emit('openMedia', 'image')"
  />

  <VideoMessageContent
    v-else-if="messageType === 'video'"
    :message="props.message"
    @open="emit('openMedia', 'video')"
  />

  <DocumentMessageContent
    v-else-if="messageType === 'document'"
    :message="props.message"
  />

  <p
    v-if="props.message.content && !props.message.recalledAt"
    :class="[
      'whitespace-pre-wrap text-sm leading-6 sm:text-base',
      isStandaloneContent
        ? [
            'mt-1.5 w-fit max-w-[min(76vw,22rem)] rounded-[1.1rem] px-3.5 py-2',
            props.isOwn
              ? 'ml-auto bg-chat-accent text-chat-on-accent'
              : 'bg-chat-incoming text-on-surface',
          ]
        : '',
    ]"
  >
    {{ props.message.content }}
  </p>
</template>
