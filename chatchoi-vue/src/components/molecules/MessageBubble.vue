<script setup lang="ts">
import { ref } from 'vue';
import type { ChatMessage } from '../../types/chat';
import { formatFileSize, formatMessageTime } from '../../utils/chatPresentation';
import { resolveDisplayName } from '../../utils/userPresentation';

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  statusText?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  retryMedia: [clientTempId: string];
  reply: [message: ChatMessage];
  recall: [message: ChatMessage];
  react: [message: ChatMessage, emoji: string];
  removeReaction: [message: ChatMessage];
}>();

const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;
const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

const getSenderName = (message: ChatMessage) => {
  const resolved = resolveDisplayName(message.sender);
  return resolved !== 'Unknown' ? resolved : message.senderName ?? 'Unknown';
};

const getMessageType = (message: ChatMessage) => message.type ?? 'text';

const getUploadStatusText = (message: ChatMessage): string => {
  if (message.localStatus === 'compressing' || message.localStatus === 'uploading' || message.localStatus === 'sending') {
    return 'Đang gửi...';
  }
  if (message.localStatus === 'failed') return message.uploadError ?? 'Gửi thất bại';
  return '';
};

const showUploadState = (message: ChatMessage): boolean => {
  return ['sending', 'compressing', 'uploading', 'failed'].includes(message.localStatus ?? '');
};

const getFooterStatusText = (message: ChatMessage): string => {
  if (showUploadState(message)) return getUploadStatusText(message);
  return props.isOwn && props.statusText ? props.statusText : formatMessageTime(message.createdAt);
};

const copyMessage = async () => {
  if (!props.message.content || props.message.recalledAt) return;
  await navigator.clipboard.writeText(props.message.content);
  copied.value = true;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = false;
    copiedTimer = null;
  }, 1200);
};
</script>

<template>
  <div
    v-if="getMessageType(props.message) === 'call_event'"
    class="mx-auto max-w-[min(90%,28rem)] animate-slide-in rounded-full bg-surface-container-high px-4 py-2 text-center text-xs sm:text-sm font-semibold text-on-surface-variant flex items-center justify-center gap-2"
  >
    <span class="material-symbols-outlined text-[18px] text-primary">call</span>
    <span class="truncate">{{ props.message.content }}</span>
    <span class="text-secondary font-medium">{{ formatMessageTime(props.message.createdAt) }}</span>
  </div>

  <div
    v-else
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
        v-if="!props.message.localStatus"
        :class="['message-actions flex flex-wrap items-center gap-1 rounded-full bg-surface-container-lowest/95 px-2 py-1 shadow-sm border border-outline-variant', props.isOwn ? 'justify-end' : 'justify-start']"
      >
        <button
          v-if="props.message.content && !props.message.recalledAt"
          class="action-pill"
          type="button"
          @click="copyMessage"
        >
          {{ copied ? 'Đã copy' : 'Copy' }}
        </button>
        <button
          v-if="!props.message.recalledAt"
          class="action-pill"
          type="button"
          @click="emit('reply', props.message)"
        >
          Reply
        </button>
        <button
          v-if="props.isOwn && !props.message.recalledAt"
          class="action-pill text-error"
          type="button"
          @click="emit('recall', props.message)"
        >
          Thu hồi
        </button>
        <template v-if="!props.message.recalledAt">
          <button
            v-for="emoji in quickReactions"
            :key="emoji"
            class="h-7 w-7 rounded-full hover:bg-surface-container-high text-sm"
            type="button"
            @click="emit('react', props.message, emoji)"
          >
            {{ emoji }}
          </button>
        </template>
      </div>

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
        <div
          v-if="props.message.replyTo"
          class="mb-2 rounded-lg border-l-4 border-primary/70 bg-surface-container-low/70 px-3 py-2 text-xs"
        >
          <p class="font-semibold opacity-80">{{ props.message.replyTo.senderName }}</p>
          <p class="line-clamp-2 opacity-75">{{ props.message.replyTo.contentPreview }}</p>
        </div>
        <p v-if="props.message.recalledAt" class="text-sm italic opacity-75">
          Tin nhắn đã được thu hồi
        </p>
        <template v-else-if="getMessageType(props.message) === 'image' || getMessageType(props.message) === 'gif'">
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
        <div v-if="props.message.localStatus === 'failed'" class="mt-2">
          <button
            v-if="props.message.canRetry && props.message.clientTempId"
            class="text-xs font-semibold text-primary hover:underline"
            type="button"
            @click="emit('retryMedia', props.message.clientTempId)"
          >
            Thử lại
          </button>
        </div>
      </div>

      <div
        v-if="props.message.reactions?.length"
        :class="['flex flex-wrap gap-1', props.isOwn ? 'justify-end' : 'justify-start']"
      >
        <button
          v-for="reaction in props.message.reactions"
          :key="reaction.emoji"
          :class="[
            'rounded-full border px-2 py-0.5 text-xs shadow-sm',
            reaction.reactedByMe ? 'border-primary bg-primary-container text-primary' : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant',
          ]"
          type="button"
          @click="reaction.reactedByMe ? emit('removeReaction', props.message) : emit('react', props.message, reaction.emoji)"
        >
          {{ reaction.emoji }} {{ reaction.count }}
        </button>
      </div>

      <div :class="['flex items-center gap-1 text-xs text-secondary', props.isOwn ? 'flex-row-reverse' : '']">
        <span
          v-if="['sending', 'compressing', 'uploading'].includes(props.message.localStatus ?? '')"
          class="upload-spinner"
          aria-hidden="true"
        ></span>
        <span :class="props.message.localStatus === 'failed' ? 'text-error' : ''">
          {{ getFooterStatusText(props.message) }}
        </span>
        <span v-if="props.isOwn" class="material-symbols-outlined text-[16px] text-primary">done_all</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-spinner {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  opacity: 0.75;
  animation: upload-spin 0.8s linear infinite;
}

@keyframes upload-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<style scoped>
.message-actions {
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.flex:hover > .message-actions,
.message-actions:focus-within {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.action-pill {
  border-radius: 9999px;
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-on-surface-variant);
}

.action-pill:hover {
  background: var(--color-surface-container-high);
}

@media (hover: none) {
  .message-actions {
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }
}
</style>
