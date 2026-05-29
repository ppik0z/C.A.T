<script setup lang="ts">
import { Button } from '@/components/ui/button';

interface Props {
  icon: string;
  label: string;
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
});
</script>

<template>
  <Button
    :aria-label="props.label"
    :title="props.label"
    :class="[
      'rounded-full',
      props.active
        ? 'bg-surface-container-high text-primary hover:bg-surface-container-high'
        : 'text-secondary hover:text-primary',
    ]"
    size="icon"
    type="button"
    :variant="props.active ? 'secondary' : 'ghost'"
  >
    <span class="material-symbols-outlined text-[22px]">{{ props.icon }}</span>
  </Button>
</template>
