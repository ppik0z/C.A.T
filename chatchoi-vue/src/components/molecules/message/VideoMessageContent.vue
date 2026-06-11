<script setup lang="ts">
import type { ChatMessage } from '../../../types/chat';

interface Props {
  message: ChatMessage;
}

const props = defineProps<Props>();
</script>

<template>
  <video
    v-if="props.message.fileUrl"
    :src="props.message.fileUrl"
    class="max-h-72 w-full rounded-xl bg-black"
    controls
  />
</template>
