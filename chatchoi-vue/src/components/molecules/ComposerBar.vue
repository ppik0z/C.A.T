<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
  sendGif: [gifUrl: string, caption: string];
  cancelReply: [];
  typingStart: [];
  typingStop: [];
}>();

const text = ref('');
const selectedFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const attachmentMenuRef = ref<HTMLElement | null>(null);
const previewUrl = ref<string | null>(null);
const errorText = ref('');
const mentionSearch = ref('');
const mentionStartIndex = ref<number | null>(null);
const selectedMentionIdsByUsername = ref<Record<string, number>>({});
const isAttachmentMenuOpen = ref(false);
const fileInputAccept = ref('');
let typingStopTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const mediaFileAccept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
const documentFileAccept = 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv';
const allFileAccept = `${mediaFileAccept},${documentFileAccept}`;

const attachmentActions = [
  {
    icon: 'photo_library',
    label: 'Ảnh hoặc video',
    description: 'Chọn media từ máy',
    accept: mediaFileAccept,
  },
  {
    icon: 'description',
    label: 'Tài liệu',
    description: 'PDF, Office, text',
    accept: documentFileAccept,
  },
] as const;

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
  isAttachmentMenuOpen.value = false;
  fileInputRef.value?.click();
};

const toggleAttachmentMenu = () => {
  errorText.value = '';
  isAttachmentMenuOpen.value = !isAttachmentMenuOpen.value;
};

const handleOutsidePointerDown = (event: PointerEvent) => {
  if (!isAttachmentMenuOpen.value) return;
  const menuElement = attachmentMenuRef.value;
  if (!menuElement || event.target instanceof Node && menuElement.contains(event.target)) return;
  isAttachmentMenuOpen.value = false;
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

const handleGif = () => {
  errorText.value = '';
  isAttachmentMenuOpen.value = false;
  const gifUrl = window.prompt('GIF URL');
  if (!gifUrl?.trim()) return;
  try {
    const url = new URL(gifUrl.trim());
    if (url.protocol !== 'https:') {
      errorText.value = 'GIF URL phải dùng HTTPS.';
      return;
    }
  } catch {
    errorText.value = 'GIF URL không hợp lệ.';
    return;
  }

  emit('sendGif', gifUrl.trim(), text.value.trim());
  text.value = '';
  clearTypingStopTimer();
  emit('typingStop');
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
  document.removeEventListener('pointerdown', handleOutsidePointerDown);
  clearTypingStopTimer();
  clearSelectedFile();
  emit('typingStop');
});

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointerDown);
});
</script>

<template>
  <footer class="relative px-3 sm:px-6 py-3 sm:py-4 bg-surface-container-lowest border-t border-outline-variant">
    <div
      v-if="props.replyTarget"
      class="mb-3 flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2"
    >
      <div class="min-w-0 flex-1 border-l-4 border-primary pl-3">
        <p class="text-xs font-bold uppercase text-primary">Đang trả lời</p>
        <p class="truncate text-sm font-semibold text-on-surface">
          {{ props.replyTarget.senderName ?? props.replyTarget.sender?.displayName ?? props.replyTarget.sender?.username }}
        </p>
        <p class="truncate text-xs text-on-surface-variant">
          {{ props.replyTarget.recalledAt ? 'Tin nhắn đã được thu hồi' : (props.replyTarget.content || props.replyTarget.fileName || '[Media]') }}
        </p>
      </div>
      <button class="h-8 w-8 rounded-full text-secondary hover:bg-surface-container-high" type="button" @click="emit('cancelReply')">
        <span class="material-symbols-outlined text-[20px]">close</span>
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
      <div ref="attachmentMenuRef" class="relative shrink-0">
        <IconButton
          icon="add_circle"
          label="Thêm media"
          :active="isAttachmentMenuOpen"
          @click="toggleAttachmentMenu"
        />

        <div
          v-if="isAttachmentMenuOpen"
          class="absolute bottom-12 left-0 z-30 w-56 rounded-2xl border border-outline-variant bg-surface-container-lowest p-2 shadow-xl"
        >
          <button
            v-for="action in attachmentActions"
            :key="action.label"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high focus:bg-surface-container-high focus:outline-none"
            type="button"
            @click="openFilePicker(action.accept)"
          >
            <span class="material-symbols-outlined text-[22px] text-primary">{{ action.icon }}</span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-on-surface">{{ action.label }}</span>
              <span class="block text-xs text-on-surface-variant">{{ action.description }}</span>
            </span>
          </button>

          <button
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high focus:bg-surface-container-high focus:outline-none"
            type="button"
            @click="handleGif"
          >
            <span class="material-symbols-outlined text-[22px] text-primary">gif_box</span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-on-surface">GIF</span>
              <span class="block text-xs text-on-surface-variant">Gửi bằng URL HTTPS</span>
            </span>
          </button>
        </div>
      </div>

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
          v-model="text"
          class="flex-1 min-w-0 bg-transparent border-none focus:ring-0 focus:outline-none text-sm sm:text-base py-2 placeholder:text-outline"
          placeholder="Type your message..."
          type="text"
          @keyup.enter="handleSend"
        />
        <button class="hidden sm:flex w-8 h-8 items-center justify-center text-primary hover:bg-surface-container-highest rounded-full transition-colors shrink-0" type="button" @click="handleGif">
          <span class="material-symbols-outlined text-[24px]">sentiment_satisfied</span>
        </button>
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
