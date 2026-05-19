<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import IconButton from '../atoms/IconButton.vue';
import { formatFileSize } from '../../utils/chatPresentation';

const emit = defineEmits<{
  send: [content: string];
  sendMedia: [file: File, caption: string];
  sendGif: [gifUrl: string, caption: string];
  typingStart: [];
  typingStop: [];
}>();

const text = ref('');
const selectedFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);
const errorText = ref('');
let typingStopTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

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

const clearTypingStopTimer = () => {
  if (!typingStopTimer) return;
  clearTimeout(typingStopTimer);
  typingStopTimer = null;
};

const handleSend = () => {
  const content = text.value.trim();
  if (!content && !selectedFile.value) return;

  if (selectedFile.value) {
    emit('sendMedia', selectedFile.value, content);
    clearSelectedFile();
  } else {
    emit('send', content);
  }

  text.value = '';
  clearTypingStopTimer();
  emit('typingStop');
};

const openFilePicker = () => {
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

const handleGif = () => {
  errorText.value = '';
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

watch(text, (value) => {
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
  <footer class="px-3 sm:px-6 py-3 sm:py-4 bg-surface-container-lowest border-t border-outline-variant">
    <div class="flex items-center gap-2 sm:gap-3">
      <input
        ref="fileInputRef"
        class="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv"
        @change="handleFileSelected"
      />
      <IconButton class="hidden xs:flex" icon="add" label="Add attachment" @click="openFilePicker" />

      <div class="flex-1 flex items-center bg-surface-container-low border border-outline-variant rounded-full px-3 sm:px-4 py-1 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all min-w-0">
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

<style scoped>
@media (min-width: 420px) {
  .xs\:flex {
    display: flex;
  }
}
</style>
