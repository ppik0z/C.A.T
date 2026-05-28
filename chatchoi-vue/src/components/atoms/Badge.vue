<script setup lang="ts">
import { Badge as UiBadge } from '@/components/ui/badge';

interface Props {
  tone?: 'primary' | 'neutral';
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'neutral',
});
</script>

<template>
  <UiBadge :variant="props.tone === 'primary' ? 'default' : 'secondary'">
    <slot />
  </UiBadge>
</template>
