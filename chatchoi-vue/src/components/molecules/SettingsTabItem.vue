<script setup lang="ts">
import { Button } from '@/components/ui/button';

interface Props {
  icon: string;
  label: string;
  summary: string;
  active: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  select: [];
}>();
</script>

<template>
  <Button
    :aria-current="props.active ? 'page' : undefined"
    :variant="props.active ? 'secondary' : 'ghost'"
    class="h-auto w-full justify-start gap-3 px-3 py-3 text-left"
    type="button"
    @click="emit('select')"
  >
    <span
      :class="[
        'material-symbols-outlined !text-[22px]',
        props.active ? 'text-primary' : 'text-on-surface-variant',
      ]"
    >
      {{ props.icon }}
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-bold text-on-surface">{{ props.label }}</span>
      <span class="mt-0.5 block truncate text-xs font-semibold text-on-surface-variant">{{ props.summary }}</span>
    </span>
  </Button>
</template>
