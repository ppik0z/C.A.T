<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  isOnline?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  isOnline: false,
  size: 'md',
});

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'w-2.5 h-2.5';
  if (props.size === 'lg') return 'w-5 h-5';
  return 'w-3.5 h-3.5';
});
</script>

<template>
  <span
    :class="[
      'inline-flex rounded-full border-2 border-surface-container-lowest shadow-sm',
      sizeClass,
      props.isOnline ? 'bg-success ring-2 ring-success/20' : 'bg-surface-container-high border-outline-variant',
    ]"
    :aria-label="props.isOnline ? 'Online' : 'Offline'"
  />
</template>
