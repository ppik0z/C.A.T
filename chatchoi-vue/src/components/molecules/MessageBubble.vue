<script setup lang="ts">
import type { ChatMessage } from '../../types/chat';
import { formatFileSize, formatMessageTime } from '../../utils/chatPresentation';

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  statusText?: string;
}

const props = defineProps<Props>();

const getSenderName = (message: ChatMessage) => {
  return message.sender?.username ?? message.senderName ?? 'Unknown';
};

const getMessageType = (message: ChatMessage) => message.type ?? 'text';
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
        <template v-if="getMessageType(props.message) === 'image' || getMessageType(props.message) === 'gif'">
          <a v-if="props.message.fileUrl" :href="props.message.fileUrl" target="_blank" rel="noreferrer">
            <img
              :src="props.message.fileUrl"
              :alt="props.message.fileName ?? 'Media message'"
              class="max-h-72 w-full rounded-xl object-cover"
            />
          </a>
        </template>

        <video
          v-else-if="getMessageType(props.message) === 'video' && props.message.fileUrl"
          :src="props.message.fileUrl"
          class="max-h-72 w-full rounded-xl bg-black"
          controls
        />

        <a
          v-else-if="getMessageType(props.message) === 'document' && props.message.fileUrl"
          :href="props.message.fileUrl"
          target="_blank"
          rel="noreferrer"
          class="flex items-center gap-3 rounded-xl bg-surface-container-low text-on-surface p-3 min-w-[14rem]"
        >
          <span class="material-symbols-outlined text-[28px] text-primary">description</span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold">{{ props.message.fileName ?? 'Tài liệu' }}</span>
            <span class="block text-xs text-secondary">{{ formatFileSize(props.message.fileSizeBytes) }}</span>
          </span>
        </a>

        <p
          v-if="props.message.content"
          :class="[
            'text-sm sm:text-base leading-6 whitespace-pre-wrap',
            getMessageType(props.message) === 'text' ? '' : 'mt-2',
          ]"
        >
          {{ props.message.content }}
        </p>
      </div>

      <div :class="['flex items-center gap-1 text-xs text-secondary', props.isOwn ? 'flex-row-reverse' : '']">
        <span>{{ props.isOwn && props.statusText ? props.statusText : formatMessageTime(props.message.createdAt) }}</span>
        <span v-if="props.isOwn" class="material-symbols-outlined text-[16px] text-primary">done_all</span>
      </div>
    </div>
  </div>
</template>
