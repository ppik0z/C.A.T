<script setup lang="ts">
import { computed } from 'vue';
import type { ChatMessage } from '../../../types/chat';
import DocumentMessageContent from './DocumentMessageContent.vue';
import ImageMessageContent from './ImageMessageContent.vue';
import VideoMessageContent from './VideoMessageContent.vue';

interface Props {
  message: ChatMessage;
}

const props = defineProps<Props>();
const messageType = computed(() => props.message.type ?? 'text');
</script>

<template>
  <p v-if="props.message.recalledAt" class="text-sm italic opacity-75">
    Tin nhắn đã được thu hồi
  </p>

  <ImageMessageContent
    v-else-if="messageType === 'image' || messageType === 'gif'"
    :message="props.message"
  />

  <VideoMessageContent
    v-else-if="messageType === 'video'"
    :message="props.message"
  />

  <DocumentMessageContent
    v-else-if="messageType === 'document'"
    :message="props.message"
  />

  <p
    v-if="props.message.content && !props.message.recalledAt"
    :class="[
      'whitespace-pre-wrap text-sm leading-6 sm:text-base',
      messageType === 'text' ? '' : 'mt-2',
    ]"
  >
    {{ props.message.content }}
  </p>
</template>
