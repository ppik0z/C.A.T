<script setup lang="ts">
import { AlertCircle, LoaderCircle } from '@lucide/vue';
import { computed } from 'vue';
import type { ChatMessage } from '../../../types/chat';

interface Props {
  message: ChatMessage;
}

const props = defineProps<Props>();

const isVisible = computed(() => {
  return ['sending', 'compressing', 'uploading', 'failed'].includes(props.message.localStatus ?? '');
});
const isFailed = computed(() => props.message.localStatus === 'failed');
const label = computed(() => {
  if (isFailed.value) return 'Gửi thất bại';
  if (props.message.localStatus === 'compressing') return 'Đang xử lý';
  if (props.message.localStatus === 'uploading') return 'Đang tải lên';
  return 'Đang gửi';
});
const progress = computed(() => {
  if (props.message.localStatus === 'compressing') {
    return props.message.compressionProgress ?? 0;
  }

  if (props.message.localStatus === 'uploading') {
    return props.message.uploadProgress ?? 0;
  }

  return 0;
});
</script>

<template>
  <div
    v-if="isVisible"
    class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/45 px-4 text-center text-white backdrop-blur-[1px]"
    aria-live="polite"
  >
    <AlertCircle v-if="isFailed" :size="26" />
    <LoaderCircle v-else :size="26" class="animate-spin" />
    <span class="text-xs font-bold">{{ label }}</span>
    <div
      v-if="!isFailed && props.message.localStatus !== 'sending'"
      class="h-1.5 w-full max-w-36 overflow-hidden rounded-full bg-white/30"
    >
      <span
        class="block h-full rounded-full bg-white transition-[width] duration-200"
        :style="{ width: `${Math.max(4, progress)}%` }"
      ></span>
    </div>
    <span
      v-if="!isFailed && props.message.localStatus !== 'sending'"
      class="text-[11px] font-semibold"
    >
      {{ progress }}%
    </span>
  </div>
</template>
