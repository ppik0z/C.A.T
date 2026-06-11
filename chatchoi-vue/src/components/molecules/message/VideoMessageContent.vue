<script setup lang="ts">
import { Play } from '@lucide/vue';
import { computed } from 'vue';
import type { ChatMessage } from '../../../types/chat';
import { formatMediaDuration, getMediaAspectRatio } from '../../../utils/mediaPresentation';
import MediaUploadOverlay from './MediaUploadOverlay.vue';

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
  16 / 9,
));
const duration = computed(() => formatMediaDuration(props.message.fileDurationSeconds));
</script>

<template>
  <button
    v-if="props.message.fileUrl"
    class="group relative block w-[min(76vw,22rem)] max-w-full overflow-hidden rounded-[1.15rem] bg-black text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent focus-visible:ring-offset-2"
    type="button"
    aria-label="Phát video"
    @click="emit('open')"
  >
    <img
      v-if="props.message.fileThumbnailUrl"
      :src="props.message.fileThumbnailUrl"
      :alt="props.message.fileName ?? 'Video message'"
      :style="{ aspectRatio }"
      class="max-h-[24rem] w-full object-cover opacity-95 transition duration-200 group-hover:opacity-85"
      decoding="async"
      loading="lazy"
    />
    <video
      v-else
      :src="props.message.fileUrl"
      :style="{ aspectRatio }"
      class="max-h-[24rem] w-full object-cover opacity-95 transition duration-200 group-hover:opacity-85"
      muted
      playsinline
      preload="metadata"
    />

    <span class="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/5" aria-hidden="true"></span>
    <span class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <span class="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition group-hover:scale-105 group-hover:bg-black/65">
        <Play :size="25" fill="currentColor" class="ml-1" />
      </span>
    </span>
    <span
      v-if="duration"
      class="absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-bold text-white"
    >
      {{ duration }}
    </span>
    <MediaUploadOverlay :message="props.message" />
  </button>
</template>
