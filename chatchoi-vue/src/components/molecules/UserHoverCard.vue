<script setup lang="ts">
import { computed, ref } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import type { Conversation } from '../../types/chat';
import {
  getConversationInitials,
  getConversationKindLabel,
  getConversationName,
  getConversationUser,
} from '../../utils/chatPresentation';

interface Props {
  conversation: Conversation | null;
  placement?: 'right' | 'bottom';
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'right',
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
  const cardHeight = 150;
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
    class="relative inline-flex"
    @focusin="openCard"
    @focusout="closeCard"
    @mouseenter="openCard"
    @mouseleave="closeCard"
  >
    <slot />
  </div>

  <Teleport to="body">
    <div
      v-if="isOpen"
      class="hidden md:block fixed z-[120] w-64 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-xl"
      :style="cardStyle"
      @mouseenter="openCard"
      @mouseleave="closeCard"
    >
      <div class="flex items-center gap-3">
        <Avatar
          :avatar-url="getConversationUser(props.conversation)?.avatar"
          :is-online="props.conversation?.isOnline"
          :name="getConversationName(props.conversation)"
          show-status
          size="lg"
        />
        <div class="min-w-0">
          <p class="font-bold text-on-surface truncate">{{ getConversationName(props.conversation) }}</p>
          <p class="text-xs font-semibold text-secondary">{{ props.conversation?.isOnline ? 'Online' : 'Offline' }}</p>
        </div>
      </div>

      <div class="mt-4 rounded-lg bg-surface-container-low p-3">
        <p class="text-xs font-semibold uppercase text-on-surface-variant">{{ getConversationKindLabel(props.conversation) }}</p>
        <p class="mt-1 text-sm text-on-surface-variant">
          {{ props.conversation?.isGroup ? getConversationInitials(props.conversation) : 'Direct realtime chat' }}
        </p>
      </div>
    </div>
  </Teleport>
</template>
