<script setup lang="ts">
import { Download, FileText } from '@lucide/vue';
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
    class="group flex min-w-[min(76vw,16rem)] max-w-[22rem] items-center gap-3 rounded-[1.1rem] border border-outline-variant/80 bg-surface-container-lowest p-3 text-on-surface shadow-sm transition hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent"
  >
    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-primary">
      <FileText :size="21" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-semibold">{{ props.message.fileName ?? 'Tài liệu' }}</span>
      <span class="block text-xs text-secondary">{{ formatFileSize(props.message.fileSizeBytes) }}</span>
    </span>
    <Download :size="18" class="shrink-0 text-on-surface-variant transition group-hover:text-primary" />
  </a>
</template>
