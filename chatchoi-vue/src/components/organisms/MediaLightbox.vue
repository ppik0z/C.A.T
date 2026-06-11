<script setup lang="ts">
import { Download, X } from '@lucide/vue';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

interface Props {
  open: boolean;
  kind: 'image' | 'video';
  url: string;
  alt?: string;
  poster?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  alt: 'Media message',
  poster: null,
});
const emit = defineEmits<{
  close: [];
}>();

const closeButtonRef = ref<HTMLButtonElement | null>(null);
let previousBodyOverflow = '';

const close = () => emit('close');
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open) close();
};

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeydown);
      await nextTick();
      closeButtonRef.value?.focus();
      return;
    }

    document.body.style.overflow = previousBodyOverflow;
    document.removeEventListener('keydown', handleKeydown);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow;
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Xem nội dung đa phương tiện"
      @click.self="close"
    >
      <div class="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-center gap-2 sm:right-6 sm:top-6">
        <a
          :href="props.url"
          download
          target="_blank"
          rel="noreferrer"
          class="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Tải xuống"
          title="Tải xuống"
        >
          <Download :size="20" />
        </a>
        <button
          ref="closeButtonRef"
          class="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          type="button"
          aria-label="Đóng"
          title="Đóng"
          @click="close"
        >
          <X :size="22" />
        </button>
      </div>

      <img
        v-if="props.kind === 'image'"
        :src="props.url"
        :alt="props.alt"
        class="max-h-[calc(100dvh-2rem)] max-w-full select-none object-contain sm:max-h-[calc(100dvh-4rem)]"
      />
      <video
        v-else
        :src="props.url"
        :poster="props.poster ?? undefined"
        class="max-h-[calc(100dvh-2rem)] max-w-full bg-black object-contain sm:max-h-[calc(100dvh-4rem)]"
        controls
        autoplay
        playsinline
      />
    </div>
  </Teleport>
</template>
