<script setup lang="ts">
import { computed, ref } from 'vue';
import Avatar from '../atoms/Avatar.vue';

interface Props {
  name: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  showStatus?: boolean;
  statusLabel: string;
  eyebrow: string;
  description: string;
  placement?: 'right' | 'bottom';
  zIndexClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: null,
  isOnline: false,
  showStatus: true,
  placement: 'right',
  zIndexClass: 'z-[130]',
});

const anchorRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const cardPosition = ref({ left: 0, top: 0 });

const cardStyle = computed(() => ({
  left: `${cardPosition.value.left}px`,
  top: `${cardPosition.value.top}px`,
}));

const updatePosition = () => {
  const anchor = anchorRef.value;
  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  const cardWidth = 256;
  const cardHeight = 156;
  const margin = 10;
  const viewportPadding = 12;

  const left = props.placement === 'bottom'
    ? rect.left
    : rect.right + margin;
  const top = props.placement === 'bottom'
    ? rect.bottom + margin
    : rect.top + (rect.height / 2) - (cardHeight / 2);

  cardPosition.value = {
    left: Math.min(Math.max(left, viewportPadding), window.innerWidth - cardWidth - viewportPadding),
    top: Math.min(Math.max(top, viewportPadding), window.innerHeight - cardHeight - viewportPadding),
  };
};

const openCard = () => {
  updatePosition();
  isOpen.value = true;
};

const closeCard = () => {
  isOpen.value = false;
};
</script>

<template>
  <div
    ref="anchorRef"
    class="relative inline-flex shrink-0 self-start items-start"
    @focusin="openCard"
    @focusout="closeCard"
    @mouseenter="openCard"
    @mouseleave="closeCard"
  >
    <slot />
  </div>

  <Teleport to="body">
    <Transition name="profile-card">
      <div
        v-if="isOpen"
        :class="['hidden md:block fixed w-64 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-xl', props.zIndexClass]"
        :style="cardStyle"
        @mouseenter="openCard"
        @mouseleave="closeCard"
      >
        <div class="flex items-center gap-3">
          <Avatar
            :avatar-url="props.avatarUrl"
            :is-online="props.isOnline"
            :name="props.name"
            :show-status="props.showStatus"
            size="lg"
          />
          <div class="min-w-0">
            <p class="font-bold text-on-surface truncate">{{ props.name }}</p>
            <p class="text-xs font-semibold text-secondary">{{ props.statusLabel }}</p>
          </div>
        </div>

        <div class="mt-4 rounded-lg bg-surface-container-low p-3">
          <p class="text-xs font-semibold uppercase text-on-surface-variant">{{ props.eyebrow }}</p>
          <p class="mt-1 text-sm text-on-surface-variant truncate">{{ props.description }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.profile-card-enter-active,
.profile-card-leave-active {
  transition:
    transform 140ms ease,
    opacity 120ms ease;
}

.profile-card-enter-from,
.profile-card-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}
</style>
