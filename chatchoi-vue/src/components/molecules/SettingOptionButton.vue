<script setup lang="ts">
import { Button } from '@/components/ui/button';

interface Props {
  label: string;
  selected: boolean;
  description?: string;
  icon?: string;
}

const props = withDefaults(defineProps<Props>(), {
  description: undefined,
  icon: undefined,
});

const emit = defineEmits<{
  select: [];
}>();
</script>

<template>
  <Button
    :aria-pressed="props.selected"
    :variant="props.selected ? 'secondary' : 'outline'"
    class="h-full min-h-16 w-full justify-start gap-3 px-3 py-3 text-left"
    type="button"
    @click="emit('select')"
  >
    <span
      v-if="props.icon"
      :class="[
        'material-symbols-outlined !text-[20px]',
        props.selected ? 'text-primary' : 'text-on-surface-variant',
      ]"
    >
      {{ props.icon }}
    </span>
    <span class="min-w-0">
      <span class="block truncate text-sm font-bold text-on-surface">{{ props.label }}</span>
      <span
        v-if="props.description"
        class="mt-0.5 block line-clamp-2 whitespace-normal text-xs font-semibold leading-4 text-on-surface-variant"
      >
        {{ props.description }}
      </span>
    </span>
  </Button>
</template>
