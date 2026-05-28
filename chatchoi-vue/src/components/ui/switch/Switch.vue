<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { SwitchRoot, SwitchThumb } from 'reka-ui';
import { cn } from '@/lib/utils';

const checked = defineModel<boolean>('checked', { default: false });
const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class'];
  disabled?: boolean;
}>(), {
  disabled: false,
});
</script>

<template>
  <SwitchRoot
    v-model:checked="checked"
    :disabled="props.disabled"
    :class="cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-outline-variant transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
      props.class,
    )"
  >
    <SwitchThumb
      :class="cn('pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0')"
    />
  </SwitchRoot>
</template>
