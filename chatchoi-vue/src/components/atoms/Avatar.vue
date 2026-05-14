<script setup lang="ts">
import { computed } from 'vue';
import OnlineStatusDot from './OnlineStatusDot.vue';
import { getUserInitials } from '../../utils/chatPresentation';

interface Props {
  name: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  showStatus?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: null,
  isOnline: false,
  showStatus: false,
  size: 'md',
});

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'w-8 h-8 text-xs';
  if (props.size === 'lg') return 'w-12 h-12 text-sm';
  if (props.size === 'xl') return 'w-24 h-24 text-2xl';
  return 'w-10 h-10 text-sm';
});

const statusSize = computed(() => (props.size === 'xl' ? 'lg' : props.size === 'sm' ? 'sm' : 'md'));
</script>

<template>
  <div class="relative inline-flex shrink-0">
    <div
      :class="[
        'rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold border-2 border-white shadow-sm overflow-hidden',
        sizeClass,
      ]"
    >
      <img v-if="props.avatarUrl" :alt="props.name" :src="props.avatarUrl" class="w-full h-full object-cover" />
      <span v-else>{{ getUserInitials(props.name) }}</span>
    </div>

    <OnlineStatusDot
      v-if="props.showStatus"
      :is-online="props.isOnline"
      :size="statusSize"
      class="absolute bottom-0 right-0"
    />
  </div>
</template>
