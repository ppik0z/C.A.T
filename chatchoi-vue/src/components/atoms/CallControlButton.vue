<script setup lang="ts">
import { Button } from '@/components/ui/button';

interface Props {
  icon: string;
  label: string;
  active?: boolean;
  tone?: 'neutral' | 'primary' | 'danger';
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  tone: 'neutral',
});

const variantByTone = {
  neutral: 'secondary',
  primary: 'default',
  danger: 'destructive',
} as const;
</script>

<template>
  <Button
    :aria-label="props.label"
    :title="props.label"
    :class="[
      'h-12 w-12 rounded-full',
      props.tone === 'neutral' && props.active ? 'bg-primary-container text-primary hover:bg-primary-container' : '',
    ]"
    size="icon"
    type="button"
    :variant="props.tone === 'neutral' && props.active ? 'secondary' : variantByTone[props.tone]"
  >
    <span class="material-symbols-outlined text-[24px]">{{ props.icon }}</span>
  </Button>
</template>
