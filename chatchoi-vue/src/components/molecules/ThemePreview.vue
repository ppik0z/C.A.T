<script setup lang="ts">
import { computed } from 'vue';
import type { FontChoice, MessageDensity } from '@/types/settings';
import type { ThemePreset } from '@/theme/themePresets';

interface Props {
  preset: ThemePreset;
  font: FontChoice;
  density: MessageDensity;
}

const props = defineProps<Props>();

const fontClasses: Record<FontChoice, string> = {
  jakarta: 'font-body',
  lexend: 'font-label',
  system: 'font-sans',
};

const messageGapClass = computed(() => (props.density === 'compact' ? 'gap-1.5 text-[13px]' : 'gap-2.5 text-sm'));
const bubblePaddingClass = computed(() => (props.density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2.5'));

const shellStyle = computed(() => ({
  backgroundColor: props.preset.colors.surfaceContainerLow,
  borderColor: props.preset.colors.outlineVariant,
  color: props.preset.colors.onSurface,
}));

const primaryStyle = computed(() => ({
  backgroundColor: props.preset.colors.primary,
  color: props.preset.colors.onPrimary,
}));

const softStyle = computed(() => ({
  backgroundColor: props.preset.colors.primaryContainer,
  color: props.preset.colors.primary,
}));

const inboundBubbleStyle = computed(() => ({
  backgroundColor: props.preset.colors.surfaceContainerHighest,
  color: props.preset.colors.onSurfaceVariant,
}));

const successDotStyle = computed(() => ({
  backgroundColor: props.preset.colors.success,
}));
</script>

<template>
  <div :class="['rounded-lg border p-4 transition-colors duration-150', fontClasses[props.font]]" :style="shellStyle">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg font-bold" :style="primaryStyle">
          C
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm font-bold">Chatchoi Settings</p>
          <p class="truncate text-xs font-semibold opacity-70">Preview</p>
        </div>
      </div>
      <span class="rounded-full px-2.5 py-1 text-xs font-bold" :style="softStyle">
        Online
      </span>
    </div>

    <div :class="['flex flex-col', messageGapClass]">
      <div class="max-w-[78%] rounded-lg" :style="inboundBubbleStyle">
        <p :class="bubblePaddingClass">Giao diện mới trông như thế này.</p>
      </div>
      <div class="ml-auto max-w-[78%] rounded-lg" :style="primaryStyle">
        <p :class="bubblePaddingClass">Preset áp dụng toàn app.</p>
      </div>
      <div class="flex items-center gap-2 text-xs font-semibold opacity-70">
        <span class="size-2 rounded-full" :style="successDotStyle" />
        <span>Đã xem · 14:32</span>
      </div>
    </div>
  </div>
</template>
