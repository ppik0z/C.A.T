<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Reply, X } from '@lucide/vue';
import IconButton from '../atoms/IconButton.vue';
import { formatFileSize } from '../../utils/chatPresentation';
import type { ChatMessage, ConversationMember } from '../../types/chat';

interface Props {
  members?: ConversationMember[];
  isGroup?: boolean;
  replyTarget?: ChatMessage | null;
}

const props = withDefaults(defineProps<Props>(), {
  members: () => [],
  isGroup: false,
  replyTarget: null,
});

const emit = defineEmits<{
  send: [content: string, mentionedUserIds: number[]];
  sendMedia: [file: File, caption: string, mentionedUserIds: number[]];
  cancelReply: [];
  typingStart: [];
  typingStop: [];
}>();

const text = ref('');
const selectedFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const messageInputRef = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);
const errorText = ref('');
const mentionSearch = ref('');
const mentionStartIndex = ref<number | null>(null);
const selectedMentionIdsByUsername = ref<Record<string, number>>({});
const fileInputAccept = ref('');
const isEmojiPickerOpen = ref(false);
let typingStopTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const mediaFileAccept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
const documentFileAccept = 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv';
const allFileAccept = `${mediaFileAccept},${documentFileAccept}`;
const quickEmojis = ['😀', '😂', '😍', '🥰', '😎', '😭', '😡', '👍', '🙏', '🔥', '❤️', '🎉'];

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

const isSelectedImage = computed(() => selectedFile.value?.type.startsWith('image/') ?? false);
const isSelectedVideo = computed(() => selectedFile.value?.type.startsWith('video/') ?? false);
const mentionedUserIds = computed(() => {
  return Object.entries(selectedMentionIdsByUsername.value)
    .filter(([username]) => text.value.includes(`@${username}`))
    .map(([, userId]) => userId);
});
const mentionOptions = computed(() => {
  if (!props.isGroup || mentionStartIndex.value === null) return [];
  const query = mentionSearch.value.trim().toLowerCase();
  return props.members
    .filter((member) => {
      if (!member.username) return false;
      return !query
        || member.username.toLowerCase().includes(query)
        || (member.displayName?.toLowerCase().includes(query) ?? false);
    })
    .slice(0, 6);
});

const clearTypingStopTimer = () => {
  if (!typingStopTimer) return;
  clearTimeout(typingStopTimer);
  typingStopTimer = null;
};

const handleSend = () => {
  const content = text.value.trim();
  if (!content && !selectedFile.value) return;

  if (selectedFile.value) {
    emit('sendMedia', selectedFile.value, content, mentionedUserIds.value);
    clearSelectedFile();
  } else {
    emit('send', content, mentionedUserIds.value);
  }

  text.value = '';
  selectedMentionIdsByUsername.value = {};
  mentionStartIndex.value = null;
  mentionSearch.value = '';
  clearTypingStopTimer();
  emit('typingStop');
};

const openFilePicker = (accept = allFileAccept) => {
  fileInputAccept.value = accept;
  fileInputRef.value?.click();
};

const handleFileSelected = (event: Event) => {
  errorText.value = '';
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';

  if (!file) return;
  if (!allowedMimeTypes.has(file.type)) {
    errorText.value = 'Định dạng file không được hỗ trợ.';
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    errorText.value = `File tối đa 10 MB. File này ${formatFileSize(file.size)}.`;
    return;
  }

  clearSelectedFile();
  selectedFile.value = file;
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
    previewUrl.value = URL.createObjectURL(file);
  }
};

const clearSelectedFile = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  selectedFile.value = null;
  previewUrl.value = null;
};

const toggleEmojiPicker = () => {
  errorText.value = '';
  isEmojiPickerOpen.value = !isEmojiPickerOpen.value;
};

const insertEmoji = async (emoji: string) => {
  const input = messageInputRef.value;
  const start = input?.selectionStart ?? text.value.length;
  const end = input?.selectionEnd ?? start;
  text.value = `${text.value.slice(0, start)}${emoji}${text.value.slice(end)}`;
  isEmojiPickerOpen.value = false;

  await nextTick();
  const cursorPosition = start + emoji.length;
  messageInputRef.value?.focus();
  messageInputRef.value?.setSelectionRange(cursorPosition, cursorPosition);
};

const updateMentionSearch = () => {
  if (!props.isGroup) return;
  const cursorIndex = text.value.length;
  const beforeCursor = text.value.slice(0, cursorIndex);
  const match = beforeCursor.match(/(^|\s)@([\w.]*)$/);
  if (!match) {
    mentionStartIndex.value = null;
    mentionSearch.value = '';
    return;
  }

  mentionStartIndex.value = cursorIndex - match[2].length - 1;
  mentionSearch.value = match[2];
};

const selectMention = (member: ConversationMember) => {
  if (mentionStartIndex.value === null || !member.username) return;
  const start = mentionStartIndex.value;
  const before = text.value.slice(0, start);
  const after = text.value.slice(text.value.length);
  text.value = `${before}@${member.username} ${after}`;
  selectedMentionIdsByUsername.value = {
    ...selectedMentionIdsByUsername.value,
    [member.username]: member.userId,
  };
  mentionStartIndex.value = null;
  mentionSearch.value = '';
};

watch(text, (value) => {
  updateMentionSearch();
  clearTypingStopTimer();
  if (!value.trim()) {
    emit('typingStop');
    return;
  }

  emit('typingStart');
  typingStopTimer = setTimeout(() => {
    emit('typingStop');
    typingStopTimer = null;
  }, 3000);
});

onBeforeUnmount(() => {
  clearTypingStopTimer();
  clearSelectedFile();
  emit('typingStop');
});
</script>

<template>
  <footer class="relative px-3 sm:px-6 py-3 sm:py-4 bg-surface-container-lowest border-t border-outline-variant">
    <div
      v-if="props.replyTarget"
      class="mb-2 mx-1 sm:mx-2 flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-low px-3 py-2 shadow-sm"
    >
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
        <Reply :size="17" stroke-width="2.3" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-bold text-primary">
          Đang trả lời {{ props.replyTarget.senderName ?? props.replyTarget.sender?.displayName ?? props.replyTarget.sender?.username }}
        </p>
        <p class="truncate text-sm font-semibold text-on-surface">
          {{ props.replyTarget.recalledAt ? 'Tin nhắn đã được thu hồi' : (props.replyTarget.content || props.replyTarget.fileName || '[Media]') }}
        </p>
      </div>
      <button
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-container-high hover:text-primary"
        type="button"
        aria-label="Huỷ trả lời"
        title="Huỷ trả lời"
        @click="emit('cancelReply')"
      >
        <X :size="17" stroke-width="2.3" />
      </button>
    </div>

    <div class="flex items-center gap-2 sm:gap-3">
      <input
        ref="fileInputRef"
        class="hidden"
        type="file"
        :accept="fileInputAccept || allFileAccept"
        @change="handleFileSelected"
      />
      <IconButton icon="add_photo_alternate" label="Thêm ảnh hoặc video" @click="openFilePicker(mediaFileAccept)" />
      <IconButton icon="attach_file" label="Đính kèm tài liệu" @click="openFilePicker(documentFileAccept)" />

      <div class="flex-1 flex items-center bg-surface-container-low border border-outline-variant rounded-full px-3 sm:px-4 py-1 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all min-w-0">
        <div
          v-if="mentionOptions.length > 0"
          class="absolute bottom-20 left-4 right-4 sm:left-8 sm:right-8 z-20 rounded-2xl border border-outline-variant bg-surface-container-lowest p-2 shadow-xl"
        >
          <button
            v-for="member in mentionOptions"
            :key="member.userId"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-container-high"
            type="button"
            @click="selectMention(member)"
          >
            <span class="h-8 w-8 rounded-full bg-primary-container text-primary flex items-center justify-center text-xs font-bold">
              {{ (member.displayName || member.username)[0]?.toUpperCase() }}
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold text-on-surface">{{ member.displayName || member.username }}</span>
              <span class="block truncate text-xs text-on-surface-variant">@{{ member.username }}</span>
            </span>
          </button>
        </div>
        <input
          ref="messageInputRef"
          v-model="text"
          class="flex-1 min-w-0 bg-transparent border-none focus:ring-0 focus:outline-none text-sm sm:text-base py-2 placeholder:text-outline"
          placeholder="Type your message..."
          type="text"
          @keyup.enter="handleSend"
        />
        <div class="relative shrink-0">
          <div
            v-if="isEmojiPickerOpen"
            class="absolute bottom-10 right-0 z-30 grid w-48 grid-cols-6 gap-1 rounded-2xl border border-outline-variant bg-surface-container-lowest p-2 shadow-xl"
          >
            <button
              v-for="emoji in quickEmojis"
              :key="emoji"
              class="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-colors hover:bg-surface-container-high focus:bg-surface-container-high focus:outline-none"
              type="button"
              :aria-label="`Chèn emoji ${emoji}`"
              @click="insertEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-container-highest"
            type="button"
            aria-label="Thêm emoji"
            title="Thêm emoji"
            @click="toggleEmojiPicker"
          >
            <span class="material-symbols-outlined text-[24px]">sentiment_satisfied</span>
          </button>
        </div>
      </div>

      <IconButton icon="send" label="Send message" @click="handleSend" />
    </div>

    <div v-if="selectedFile" class="mt-3 mx-2 sm:mx-4 flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-2">
      <img
        v-if="isSelectedImage && previewUrl"
        :src="previewUrl"
        alt=""
        class="h-12 w-12 rounded-md object-cover"
      />
      <video
        v-else-if="isSelectedVideo && previewUrl"
        :src="previewUrl"
        class="h-12 w-16 rounded-md object-cover"
        muted
      />
      <div v-else class="h-12 w-12 rounded-md bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
        <span class="material-symbols-outlined text-[24px]">description</span>
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-on-surface">{{ selectedFile.name }}</p>
        <p class="text-xs text-secondary">{{ formatFileSize(selectedFile.size) }}</p>
      </div>

      <button class="h-8 w-8 rounded-full hover:bg-surface-container-highest text-secondary" type="button" @click="clearSelectedFile">
        <span class="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>

    <p v-if="errorText" class="mt-2 px-2 sm:px-4 text-xs text-error">{{ errorText }}</p>
  </footer>
</template>
