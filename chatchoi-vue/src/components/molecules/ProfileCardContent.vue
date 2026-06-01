<script setup lang="ts">
import Avatar from '../atoms/Avatar.vue';

interface Props {
  name: string;
  username?: string;
  avatarUrl?: string | null;
  banner?: string | null;
  bio?: string | null;
  customStatus?: string | null;
  isOnline?: boolean;
  showStatus?: boolean;
  statusLabel: string;
  eyebrow: string;
  description?: string;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: null,
  banner: null,
  bio: null,
  customStatus: null,
  isOnline: false,
  showStatus: true,
  description: '',
  isLoading: false,
});
</script>

<template>
  <div>
    <div
      class="h-16 rounded-t-xl bg-primary-container"
      :style="props.banner ? { backgroundImage: `url(${props.banner})`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined"
    ></div>

    <div class="px-4 pb-4">
      <Avatar
        :avatar-url="props.avatarUrl"
        :is-online="props.isOnline"
        :name="props.name"
        :show-status="props.showStatus"
        class="-mt-7"
        size="lg"
      />

      <div class="mt-3 min-w-0">
        <p class="truncate font-bold text-on-surface">{{ props.name }}</p>
        <p v-if="props.username" class="truncate text-xs text-on-surface-variant/70">{{ props.username }}</p>
        <p class="mt-1 text-xs font-semibold text-secondary">{{ props.statusLabel }}</p>
      </div>

      <div v-if="props.isLoading" class="mt-4 space-y-2" aria-label="Đang tải hồ sơ">
        <div class="h-3 w-20 animate-pulse rounded bg-surface-container-high"></div>
        <div class="h-3 w-full animate-pulse rounded bg-surface-container-high"></div>
      </div>

      <template v-else>
        <p v-if="props.customStatus" class="mt-4 rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface">
          {{ props.customStatus }}
        </p>

        <div v-if="props.bio || props.description" class="mt-4">
          <p class="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{{ props.eyebrow }}</p>
          <p class="mt-1 whitespace-pre-wrap break-words text-sm text-on-surface-variant">
            {{ props.bio || props.description }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
