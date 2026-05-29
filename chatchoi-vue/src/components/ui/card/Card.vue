<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <div
    data-slot="card"
    :class="cn('rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface shadow-sm', props.class)"
  >
    <slot />
  </div>
</template>
