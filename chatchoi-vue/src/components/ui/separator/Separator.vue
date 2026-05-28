<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = withDefaults(defineProps<{
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
  class?: HTMLAttributes['class'];
}>(), {
  orientation: 'horizontal',
  decorative: true,
});
</script>

<template>
  <div
    :aria-orientation="props.decorative ? undefined : props.orientation"
    :role="props.decorative ? 'none' : 'separator'"
    :class="cn(
      'shrink-0 bg-outline-variant',
      props.orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      props.class,
    )"
  />
</template>
