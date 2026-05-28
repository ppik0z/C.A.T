<script setup lang="ts">
import { computed } from 'vue';
import type { AccentColor, FontChoice, MessageDensity, ThemeMode } from '@/types/settings';

interface Props {
  mode: ThemeMode;
  accent: AccentColor;
  font: FontChoice;
  density: MessageDensity;
}

const props = defineProps<Props>();

const accentClasses: Record<AccentColor, string> = {
  ocean: 'bg-primary text-on-primary',
  emerald: 'bg-emerald-600 text-white',
  violet: 'bg-violet-600 text-white',
  rose: 'bg-rose-600 text-white',
};

const accentSoftClasses: Record<AccentColor, string> = {
  ocean: 'bg-primary-container text-primary',
  emerald: 'bg-emerald-100 text-emerald-700',
  violet: 'bg-violet-100 text-violet-700',
  rose: 'bg-rose-100 text-rose-700',
};

const fontClasses: Record<FontChoice, string> = {
  jakarta: 'font-body',
  lexend: 'font-label',
  system: 'font-sans',
};

const previewShellClass = computed(() => {
  if (props.mode === 'dark') return 'bg-slate-950 text-slate-100 border-slate-800';
  if (props.mode === 'light') return 'bg-white text-slate-950 border-slate-200';
  return 'bg-gradient-to-br from-white via-surface-container-low to-slate-900 text-slate-950 border-outline-variant';
});

const messageGapClass = computed(() => (props.density === 'compact' ? 'gap-1.5 text-[13px]' : 'gap-2.5 text-sm'));
const bubblePaddingClass = computed(() => (props.density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2.5'));
</script>

<template>
  <div :class="['rounded-lg border p-4 transition-colors duration-150', previewShellClass, fontClasses[props.font]]">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <div :class="['flex size-9 shrink-0 items-center justify-center rounded-lg font-bold', accentClasses[props.accent]]">
          C
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm font-bold">Chatchoi Settings</p>
          <p class="truncate text-xs font-semibold opacity-70">Preview</p>
        </div>
      </div>
      <span :class="['rounded-full px-2.5 py-1 text-xs font-bold', accentSoftClasses[props.accent]]">
        Online
      </span>
    </div>

    <div :class="['flex flex-col', messageGapClass]">
      <div class="max-w-[78%] rounded-lg bg-surface-container-high text-on-surface">
        <p :class="bubblePaddingClass">Giao diện mới trônng như thế này.</p>
      </div>
      <div :class="['ml-auto max-w-[78%] rounded-lg', accentClasses[props.accent]]">
        <p :class="bubblePaddingClass">Giao diện mới nè.</p>
      </div>
      <div class="flex items-center gap-2 text-xs font-semibold opacity-70">
        <span class="size-2 rounded-full bg-emerald-500" />
        <span>Đã xem · 14:32</span>
      </div>
    </div>
  </div>
</template>
