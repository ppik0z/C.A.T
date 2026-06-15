<script setup lang="ts">
import { computed } from 'vue';
import type { FontChoice, FontSize, MessageDensity } from '@/types/settings';
import type { ThemePreset } from '@/theme/themePresets';
import { fontFamilies, fontSizeMap } from '@/theme/appearanceRuntime';
import BrandLogo from '@/components/atoms/BrandLogo.vue';

interface Props {
  preset: ThemePreset;
  font: FontChoice;
  fontSize: FontSize;
  density: MessageDensity;
}

const props = defineProps<Props>();

// Remove old fontClasses mapping

const messageGapClass = computed(() => (props.density === 'compact' ? 'gap-1.5 text-[13px]' : 'gap-2.5 text-sm'));
const bubblePaddingClass = computed(() => (props.density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2.5'));

const scaleFactor = computed(() => {
  const size = fontSizeMap[props.fontSize] || '16px';
  return parseInt(size) / 16;
});

const shellStyle = computed(() => ({
  backgroundColor: props.preset.colors.surfaceContainerLow,
  borderColor: props.preset.colors.outlineVariant,
  color: props.preset.colors.onSurface,
  '--font-body': fontFamilies[props.font],
  '--font-label': props.font === 'jakarta' ? fontFamilies['lexend'] : fontFamilies[props.font],
  fontFamily: fontFamilies[props.font],
}));

const innerStyle = computed(() => ({
  transform: `scale(${scaleFactor.value})`,
  transformOrigin: 'top left',
  width: `${100 / scaleFactor.value}%`,
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
  <div class="rounded-lg border transition-all duration-150 overflow-hidden" :style="shellStyle">
    <div :style="innerStyle" class="p-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <BrandLogo alt="" class="size-9 rounded-lg shadow-sm" />
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
  </div>
</template>
