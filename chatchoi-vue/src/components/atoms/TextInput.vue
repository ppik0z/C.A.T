<script setup lang="ts">
import { Input } from '@/components/ui/input';

interface Props {
  placeholder?: string;
  icon?: string;
  maxlength?: number;
}

const model = defineModel<string>({ required: true });
const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  icon: undefined,
  maxlength: undefined,
});
</script>

<template>
  <label class="relative block">
    <span
      v-if="props.icon"
      class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]"
    >
      {{ props.icon }}
    </span>
    <Input
      v-model="model"
      :class="[
        'h-11 rounded-xl bg-surface-container-low pr-4 text-base focus-visible:border-transparent',
        props.icon ? 'pl-11' : 'pl-4',
      ]"
      :placeholder="props.placeholder"
      :maxlength="props.maxlength"
    />
  </label>
</template>
