<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const model = defineModel<string>({ default: '' });
const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class'];
  type?: string;
}>(), {
  type: 'text',
});
</script>

<template>
  <input
    v-model="model"
    v-bind="$attrs"
    :class="cn(
      'flex h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface placeholder:text-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
    :type="props.type"
  />
</template>
