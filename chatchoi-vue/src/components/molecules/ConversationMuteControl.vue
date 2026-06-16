<script setup lang="ts">
import { computed, ref } from 'vue';
import { Bell, BellOff } from '@lucide/vue';
import { useChatStore } from '../../stores/chat';
import type { Conversation } from '../../types/chat';

interface Props {
  conversation: Conversation | null;
}

const props = defineProps<Props>();
const chatStore = useChatStore();

const isExpanded = ref(false);
const isLoading = ref(false);

// Mốc xa (>= năm 9000) nghĩa là tắt cho đến khi người dùng bật lại.
const INDEFINITE_YEAR = 9000;

const presets: { label: string; durationMinutes: number }[] = [
  { label: 'Trong 15 phút', durationMinutes: 15 },
  { label: 'Trong 1 giờ', durationMinutes: 60 },
  { label: 'Trong 8 giờ', durationMinutes: 480 },
  { label: 'Trong 24 giờ', durationMinutes: 1440 },
  { label: 'Cho đến khi tôi bật lại', durationMinutes: 0 },
];

const isMuted = computed(() => props.conversation?.isMuted ?? false);

const mutedSubtitle = computed(() => {
  const raw = props.conversation?.mutedUntil;
  if (!raw) return '';
  const until = new Date(raw);
  if (until.getFullYear() >= INDEFINITE_YEAR) return 'Cho đến khi bạn bật lại';
  const sameDay = until.toDateString() === new Date().toDateString();
  const time = until.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return sameDay
    ? `Đến ${time}`
    : `Đến ${until.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${time}`;
});

const apply = async (durationMinutes: number | null) => {
  if (!props.conversation || isLoading.value) return;
  isLoading.value = true;
  try {
    await chatStore.muteConversation(props.conversation.id, durationMinutes);
    isExpanded.value = false;
  } catch (error) {
    console.error('Không thể cập nhật thông báo hội thoại.', error);
  } finally {
    isLoading.value = false;
  }
};

const unmute = () => apply(null);
</script>

<template>
  <div v-if="props.conversation" class="w-full">
    <!-- Đang tắt thông báo -->
    <div v-if="isMuted" class="flex items-center gap-3 rounded-xl bg-surface-container-high/60 p-2">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-container-highest text-on-surface-variant">
        <BellOff class="h-5 w-5" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-on-surface">Đã tắt thông báo</p>
        <p v-if="mutedSubtitle" class="truncate text-xs text-on-surface-variant">{{ mutedSubtitle }}</p>
      </div>
      <button
        class="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition hover:bg-primary/90 disabled:opacity-60"
        type="button"
        :disabled="isLoading"
        @click="unmute"
      >
        Bật lại
      </button>
    </div>

    <!-- Chưa tắt -> nút mở danh sách preset -->
    <template v-else>
      <button
        class="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-surface-container-high"
        type="button"
        @click="isExpanded = !isExpanded"
      >
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-container-high text-on-surface-variant">
          <Bell class="h-5 w-5" aria-hidden="true" />
        </span>
        <span class="flex-1 text-sm font-semibold text-on-surface">Tắt thông báo</span>
        <span class="material-symbols-outlined text-outline">{{ isExpanded ? 'expand_less' : 'expand_more' }}</span>
      </button>

      <div v-if="isExpanded" class="mt-1 overflow-hidden rounded-xl border border-outline-variant/70">
        <button
          v-for="preset in presets"
          :key="preset.durationMinutes"
          class="flex w-full items-center px-3 py-2.5 text-left text-sm text-on-surface transition hover:bg-surface-container-high disabled:opacity-60"
          type="button"
          :disabled="isLoading"
          @click="apply(preset.durationMinutes)"
        >
          {{ preset.label }}
        </button>
      </div>
    </template>
  </div>
</template>
