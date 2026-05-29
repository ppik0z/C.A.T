<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <p data-slot="card-description" :class="cn('text-sm font-medium leading-5 text-on-surface-variant', props.class)">
    <slot />
  </p>
</template>
