<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import ProfileCardContent from './ProfileCardContent.vue';
import { useProfilesStore } from '../../stores/profiles';

interface Props {
  userId?: number;
  name: string;
  username?: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  showStatus?: boolean;
  statusLabel: string;
  eyebrow: string;
  description?: string;
  placement?: 'right' | 'bottom';
  zIndexClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: null,
  isOnline: false,
  showStatus: true,
  description: '',
  placement: 'right',
  zIndexClass: 'z-[130]',
});

const profilesStore = useProfilesStore();
const anchorRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const isLoading = ref(false);
const cardPosition = ref({ left: 0, top: 0 });
let closeTimer: ReturnType<typeof setTimeout> | null = null;

const profile = computed(() => props.userId ? profilesStore.profilesByUserId[props.userId] : undefined);
const cardStyle = computed(() => ({
  left: `${cardPosition.value.left}px`,
  top: `${cardPosition.value.top}px`,
}));

const updatePosition = () => {
  const anchor = anchorRef.value;
  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  const cardWidth = 288;
  const cardHeight = 280;
  const margin = 10;
  const viewportPadding = 12;
  const left = props.placement === 'bottom' ? rect.left : rect.right + margin;
  const top = props.placement === 'bottom' ? rect.bottom + margin : rect.top + (rect.height / 2) - (cardHeight / 2);

  cardPosition.value = {
    left: Math.min(Math.max(left, viewportPadding), window.innerWidth - cardWidth - viewportPadding),
    top: Math.min(Math.max(top, viewportPadding), window.innerHeight - cardHeight - viewportPadding),
  };
};

const cancelClose = () => {
  if (!closeTimer) return;
  clearTimeout(closeTimer);
  closeTimer = null;
};

const loadProfile = async () => {
  if (!props.userId) return;
  isLoading.value = true;
  try {
    await profilesStore.loadProfile(props.userId);
  } catch (error) {
    console.error('Failed to load public profile', error);
  } finally {
    isLoading.value = false;
  }
};

const openCard = () => {
  cancelClose();
  updatePosition();
  isOpen.value = true;
  void loadProfile();
};

const closeCard = () => {
  cancelClose();
  closeTimer = setTimeout(() => {
    isOpen.value = false;
  }, 120);
};

const toggleCard = () => {
  if (isOpen.value) {
    isOpen.value = false;
    return;
  }
  openCard();
};

onBeforeUnmount(cancelClose);
</script>

<template>
  <span
    ref="anchorRef"
    class="relative inline-flex shrink-0 self-start items-start"
    @focusin="openCard"
    @focusout="closeCard"
    @click.stop="toggleCard"
    @mouseenter="openCard"
    @mouseleave="closeCard"
  >
    <slot />
  </span>

  <Teleport to="body">
    <Transition name="profile-card">
      <div
        v-if="isOpen"
        :class="['fixed w-72 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-xl', props.zIndexClass]"
        :style="cardStyle"
        role="dialog"
        @focusin="openCard"
        @focusout="closeCard"
        @click.stop
        @mouseenter="openCard"
        @mouseleave="closeCard"
      >
        <ProfileCardContent
          :avatar-url="profile?.avatar ?? props.avatarUrl"
          :banner="profile?.banner"
          :bio="profile?.bio"
          :custom-status="profile?.customStatus"
          :description="props.description"
          :eyebrow="props.eyebrow"
          :is-loading="isLoading && !profile"
          :is-online="profile ? profile.presence === 'online' : props.isOnline"
          :name="profile?.displayName || profile?.username || props.name"
          :show-status="props.showStatus"
          :status-label="profile ? (profile.presence === 'online' ? 'Online' : 'Offline') : props.statusLabel"
          :username="profile?.username ? `@${profile.username}` : props.username"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.profile-card-enter-active,
.profile-card-leave-active {
  transition: transform 140ms ease, opacity 120ms ease;
}

.profile-card-enter-from,
.profile-card-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}
</style>
