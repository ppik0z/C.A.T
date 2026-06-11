<script setup lang="ts">
import { computed } from 'vue';
import type { ChatMessage } from '../../../types/chat';
import { getMediaAspectRatio } from '../../../utils/mediaPresentation';

interface Props {
  message: ChatMessage;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  open: [];
}>();

const aspectRatio = computed(() => getMediaAspectRatio(
  props.message.fileWidth,
  props.message.fileHeight,
));
</script>

<template>
  <button
    v-if="props.message.fileUrl"
    class="group relative block max-w-[min(76vw,22rem)] overflow-hidden rounded-[1.15rem] bg-black/5 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent focus-visible:ring-offset-2"
    type="button"
    aria-label="Mở ảnh"
    @click="emit('open')"
  >
    <img
      :src="props.message.fileUrl"
      :alt="props.message.fileName ?? 'Media message'"
      :width="props.message.fileWidth ?? undefined"
      :height="props.message.fileHeight ?? undefined"
      :style="{ aspectRatio }"
      class="block max-h-[28rem] w-full object-cover transition duration-200 group-hover:brightness-95"
      decoding="async"
      loading="lazy"
    />
  </button>
</template>
