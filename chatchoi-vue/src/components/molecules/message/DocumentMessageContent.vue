<script setup lang="ts">
import type { ChatMessage } from '../../../types/chat';
import { formatFileSize } from '../../../utils/chatPresentation';

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
    class="flex min-w-[14rem] items-center gap-3 rounded-xl bg-surface-container-low p-3 text-on-surface"
  >
    <span class="material-symbols-outlined text-[28px] text-primary">description</span>
    <span class="min-w-0">
      <span class="block truncate text-sm font-semibold">{{ props.message.fileName ?? 'Tài liệu' }}</span>
      <span class="block text-xs text-secondary">{{ formatFileSize(props.message.fileSizeBytes) }}</span>
    </span>
  </a>
</template>
