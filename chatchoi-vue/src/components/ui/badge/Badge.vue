<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'destructive' | 'outline';

const props = withDefaults(defineProps<{
  variant?: BadgeVariant;
  class?: HTMLAttributes['class'];
}>(), {
  variant: 'secondary',
});

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary text-on-primary',
  secondary: 'bg-surface-container-high text-on-surface-variant',
  success: 'bg-success-container text-on-success-container',
  destructive: 'bg-error text-on-error',
  outline: 'border border-outline-variant bg-transparent text-on-surface',
};
</script>

<template>
  <span
    data-slot="badge"
    :class="cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap transition-colors duration-150',
      variantClasses[props.variant],
      props.class,
    )"
  >
    <slot />
  </span>
</template>
