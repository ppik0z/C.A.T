<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Camera, ImagePlus, Trash2 } from '@lucide/vue';
import Avatar from '../atoms/Avatar.vue';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface Props {
  name: string;
  existingUrl?: string | null;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  existingUrl: null,
  disabled: false,
});
const file = defineModel<File | null>({ required: true });
const fileInput = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);
const error = ref<string | null>(null);

const displayedAvatar = computed(() => previewUrl.value ?? props.existingUrl);

watch(file, (nextFile) => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = nextFile ? URL.createObjectURL(nextFile) : null;
}, { immediate: true });

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});

const openPicker = () => {
  if (!props.disabled) fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const selectedFile = input.files?.[0];
  input.value = '';
  if (!selectedFile) return;

  if (!SUPPORTED_TYPES.has(selectedFile.type)) {
    error.value = 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.';
    return;
  }
  if (selectedFile.size > MAX_FILE_BYTES) {
    error.value = 'Ảnh không được vượt quá 5MB.';
    return;
  }

  error.value = null;
  file.value = selectedFile;
};

const clearSelection = () => {
  error.value = null;
  file.value = null;
};
</script>

<template>
  <div class="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
    <div class="relative shrink-0">
      <button
        class="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="props.disabled"
        type="button"
        aria-label="Chọn ảnh đại diện nhóm"
        @click="openPicker"
      >
        <Avatar
          :avatar-url="displayedAvatar"
          :name="props.name || 'Nhóm mới'"
          size="xl"
          class="ring-4 ring-primary-container shadow-lg"
        />
        <span class="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white transition group-hover:bg-black/35 group-focus-visible:bg-black/35">
          <Camera class="h-6 w-6 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
        </span>
      </button>

      <button
        v-if="file"
        class="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-error text-on-error shadow-md transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
        type="button"
        aria-label="Bỏ ảnh đã chọn"
        @click="clearSelection"
      >
        <Trash2 class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>

    <div class="min-w-0 text-center sm:pt-2 sm:text-left">
      <button
        class="inline-flex h-10 items-center gap-2 rounded-full bg-primary-container px-4 text-sm font-bold text-primary transition hover:bg-primary-container/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
        :disabled="props.disabled"
        type="button"
        @click="openPicker"
      >
        <ImagePlus class="h-4 w-4" aria-hidden="true" />
        {{ file ? 'Chọn ảnh khác' : 'Thêm ảnh nhóm' }}
      </button>
      <p class="mt-2 text-xs font-medium text-on-surface-variant">
        JPEG, PNG hoặc WebP · tối đa 5MB
      </p>
      <p v-if="file" class="mt-1 max-w-64 truncate text-xs font-semibold text-primary">
        {{ file.name }}
      </p>
      <p v-if="error" class="mt-1 text-xs font-semibold text-error" role="alert">
        {{ error }}
      </p>
    </div>

    <input
      ref="fileInput"
      class="sr-only"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      @change="handleFileChange"
    />
  </div>
</template>
