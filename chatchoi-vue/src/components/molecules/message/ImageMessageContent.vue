<script setup lang="ts">
import type { ChatMessage } from '../../../types/chat';

interface Props {
  message: ChatMessage;
}

const props = defineProps<Props>();
</script>

<template>
  <a
    v-if="props.message.fileUrl"
    :href="props.message.fileUrl"
    target="_blank"
    rel="noreferrer"
  >
    <img
      :src="props.message.fileUrl"
      :alt="props.message.fileName ?? 'Media message'"
      class="max-h-72 w-full rounded-xl object-cover"
    />
  </a>
</template>
