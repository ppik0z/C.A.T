<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Copy, MoreHorizontal, Reply, RotateCcw, Smile } from '@lucide/vue';
import type { ChatMessage } from '../../types/chat';
import { formatMessageTime } from '../../utils/chatPresentation';
import { resolveDisplayName } from '../../utils/userPresentation';
import MessageContentRenderer from './message/MessageContentRenderer.vue';

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
const isMenuOpen = ref(false);
const isReactionOpen = ref(false);
const actionRootRef = ref<HTMLElement | null>(null);
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

const showMessageControls = (message: ChatMessage): boolean => {
  return !showUploadState(message);
};

const getFooterStatusText = (message: ChatMessage): string => {
  if (showUploadState(message)) return getUploadStatusText(message);
  return props.isOwn && props.statusText ? props.statusText : formatMessageTime(message.createdAt);
};

const copyMessage = async () => {
  if (!props.message.content || props.message.recalledAt) return;
  await navigator.clipboard.writeText(props.message.content);
  copied.value = true;
  closeActions();
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = false;
    copiedTimer = null;
  }, 1200);
};

const closeActions = () => {
  isMenuOpen.value = false;
  isReactionOpen.value = false;
};

const isAnyActionOpen = () => isMenuOpen.value || isReactionOpen.value;

const handleOutsidePointerDown = (event: PointerEvent) => {
  if (!isAnyActionOpen()) return;
  const actionElement = actionRootRef.value;
  if (actionElement && event.target instanceof Node && actionElement.contains(event.target)) return;
  closeActions();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !isAnyActionOpen()) return;
  closeActions();
};

const toggleMenu = () => {
  isReactionOpen.value = false;
  isMenuOpen.value = !isMenuOpen.value;
};

const toggleReactionPicker = () => {
  isMenuOpen.value = false;
  isReactionOpen.value = !isReactionOpen.value;
};

const replyToMessage = () => {
  emit('reply', props.message);
  closeActions();
};

const recallMessage = () => {
  emit('recall', props.message);
  closeActions();
};

const reactToMessage = (emoji: string) => {
  emit('react', props.message, emoji);
  closeActions();
};

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointerDown);
  document.removeEventListener('keydown', handleKeydown);
  if (copiedTimer) clearTimeout(copiedTimer);
});

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointerDown);
  document.addEventListener('keydown', handleKeydown);
});

watch(
  () => props.message.id,
  () => closeActions(),
);
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
      'flex gap-2 sm:gap-3 max-w-[min(90%,40rem)] sm:max-w-[min(78%,40rem)] animate-slide-in',
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
        v-if="props.message.replyTo"
        :class="[
          'max-w-[min(100%,22rem)] rounded-2xl border border-outline-variant/70 bg-surface-container-lowest/90 px-3 py-2 text-on-surface-variant shadow-sm backdrop-blur-sm',
          props.isOwn ? 'rounded-br-md mr-2' : 'rounded-bl-md ml-2',
        ]"
      >
        <p class="truncate text-[11px] font-bold text-secondary">
          Trả lời {{ props.message.replyTo.senderName }}
        </p>
        <p class="mt-0.5 line-clamp-2 text-xs leading-4 opacity-85">
          {{ props.message.replyTo.contentPreview }}
        </p>
      </div>

      <div
        :class="[
          'px-3.5 py-2.5 sm:px-4 sm:py-3 break-words',
          props.isOwn
            ? 'bg-chat-accent text-chat-on-accent rounded-[1.25rem] rounded-br-md'
            : 'bg-chat-incoming text-on-surface rounded-[1.25rem] rounded-bl-md',
        ]"
      >
        <p v-if="!props.isOwn" class="text-[11px] font-semibold text-on-surface-variant mb-1">
          {{ getSenderName(props.message) }}
        </p>
        <MessageContentRenderer :message="props.message" />
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
          @click="reaction.reactedByMe ? emit('removeReaction', props.message) : reactToMessage(reaction.emoji)"
        >
          {{ reaction.emoji }} {{ reaction.count }}
        </button>
      </div>

      <div :class="['flex items-center gap-1 px-1 text-[11px] text-on-surface-variant', props.isOwn ? 'flex-row-reverse' : '']">
        <span
          v-if="['sending', 'compressing', 'uploading'].includes(props.message.localStatus ?? '')"
          class="upload-spinner"
          aria-hidden="true"
        ></span>
        <span :class="props.message.localStatus === 'failed' ? 'text-error' : ''">
          {{ getFooterStatusText(props.message) }}
        </span>
        <span v-if="props.isOwn" class="material-symbols-outlined text-[15px] text-chat-accent">done_all</span>
      </div>
    </div>

    <div
      v-if="showMessageControls(props.message)"
      ref="actionRootRef"
      :class="['relative flex shrink-0 items-center gap-1 self-end pb-5', props.isOwn ? 'flex-row-reverse' : '']"
    >
      <button
        v-if="!props.message.recalledAt"
        class="message-icon-button"
        type="button"
        aria-label="Thả reaction"
        title="Thả reaction"
        @click="toggleReactionPicker"
      >
        <Smile :size="17" stroke-width="2.2" />
      </button>

      <button
        class="message-icon-button"
        type="button"
        aria-label="Mở tuỳ chọn tin nhắn"
        title="Tuỳ chọn"
        @click="toggleMenu"
      >
        <MoreHorizontal :size="18" stroke-width="2.2" />
      </button>

      <div
        v-if="isReactionOpen && !props.message.recalledAt"
        :class="[
          'absolute bottom-14 z-20 flex gap-1 rounded-2xl border border-outline-variant bg-surface-container-lowest p-2 shadow-xl',
          props.isOwn ? 'right-0' : 'left-0',
        ]"
      >
        <template v-if="!props.message.recalledAt">
          <button
            v-for="emoji in quickReactions"
            :key="emoji"
            class="h-9 w-9 rounded-full text-lg hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            type="button"
            @click="reactToMessage(emoji)"
          >
            {{ emoji }}
          </button>
        </template>
      </div>

      <div
        v-if="isMenuOpen"
        :class="[
          'absolute bottom-14 z-20 w-48 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest py-1 shadow-xl',
          props.isOwn ? 'right-0' : 'left-0',
        ]"
      >
        <div v-if="copied" class="px-3 py-2 text-xs font-bold text-primary">Đã sao chép</div>
        <button
          v-if="props.message.content && !props.message.recalledAt"
          class="menu-item"
          type="button"
          @click="copyMessage"
        >
          <Copy :size="16" />
          <span>Copy</span>
        </button>
        <button
          v-if="!props.message.recalledAt"
          class="menu-item"
          type="button"
          @click="replyToMessage"
        >
          <Reply :size="16" />
          <span>Trả lời</span>
        </button>
        <button
          v-if="props.isOwn && !props.message.recalledAt"
          class="menu-item text-error hover:bg-error-container/30"
          type="button"
          @click="recallMessage"
        >
          <RotateCcw :size="16" />
          <span>Thu hồi</span>
        </button>
        <div v-if="props.message.recalledAt" class="px-3 py-2 text-sm text-on-surface-variant">
          Không còn thao tác khả dụng.
        </div>
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
.message-icon-button {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid var(--color-outline-variant);
  background: color-mix(in srgb, var(--color-surface-container-lowest) 94%, transparent);
  color: var(--color-on-surface-variant);
  box-shadow: 0 8px 18px rgb(0 0 0 / 0.08);
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.message-icon-button:hover,
.message-icon-button:focus-visible {
  background: var(--color-surface-container-high);
  color: var(--color-primary);
  outline: none;
}

.message-icon-button:active {
  transform: scale(0.96);
}

.menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-on-surface-variant);
}

.menu-item:hover,
.menu-item:focus-visible {
  background: var(--color-surface-container-high);
  outline: none;
}
</style>
