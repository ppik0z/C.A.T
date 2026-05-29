<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const props = withDefaults(defineProps<{
  alt: string;
  src?: string | null;
  size?: AvatarSize;
  class?: HTMLAttributes['class'];
}>(), {
  src: null,
  size: 'md',
});

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-sm',
  xl: 'size-24 text-2xl',
};

const initials = computed(() => {
  const words = props.alt.trim().split(/\s+/).filter(Boolean);
  const fallback = props.alt.trim().charAt(0) || 'U';
  return words.length > 1
    ? `${words[0][0] ?? ''}${words[words.length - 1][0] ?? ''}`.toUpperCase()
    : fallback.toUpperCase();
});
</script>

<template>
  <span
    data-slot="avatar"
    :class="cn(
      'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-surface-container-lowest bg-secondary-container font-bold text-on-secondary-container shadow-sm',
      sizeClasses[props.size],
      props.class,
    )"
  >
    <img v-if="props.src" :alt="props.alt" :src="props.src" class="h-full w-full object-cover" />
    <span v-else>{{ initials }}</span>
  </span>
</template>
