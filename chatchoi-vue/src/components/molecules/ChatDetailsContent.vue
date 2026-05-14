<script setup lang="ts">
import Avatar from '../atoms/Avatar.vue';
import type { Conversation } from '../../types/chat';
import { getConversationKindLabel, getConversationName, getConversationUser } from '../../utils/chatPresentation';

interface Props {
  conversation: Conversation | null;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
});

const actionItems = [
  { icon: 'call', label: 'Call' },
  { icon: 'videocam', label: 'Video' },
  { icon: 'search', label: 'Search' },
  { icon: 'notifications_off', label: 'Mute' },
];

const settingItems = [
  { icon: 'notifications', label: 'Notifications', value: null },
  { icon: 'security', label: 'Privacy & Safety', value: null },
  { icon: 'group', label: 'Members', value: '2 People' },
];
</script>

<template>
  <div class="w-full">
    <div :class="['flex flex-col items-center border-b border-outline-variant bg-surface-container-low/50', props.compact ? 'p-4' : 'p-8']">
      <Avatar
        :avatar-url="getConversationUser(props.conversation)?.avatar"
        :is-online="props.conversation?.isOnline"
        :name="getConversationName(props.conversation)"
        :class="props.compact ? 'mb-2' : 'mb-4'"
        show-status
        :size="props.compact ? 'lg' : 'xl'"
      />

      <h3 :class="['font-bold text-on-surface text-center', props.compact ? 'text-lg' : 'text-xl']">{{ getConversationName(props.conversation) }}</h3>
      <p class="text-sm font-semibold text-secondary mt-1">{{ props.conversation?.isOnline ? 'Online' : 'Offline' }}</p>
      <p :class="['text-xs font-semibold uppercase text-on-surface-variant', props.compact ? 'mt-1' : 'mt-2']">{{ getConversationKindLabel(props.conversation) }}</p>

      <div :class="['grid grid-cols-4 w-full', props.compact ? 'gap-2 mt-4' : 'gap-4 mt-8']">
        <button v-for="item in actionItems" :key="item.icon" class="flex flex-col items-center gap-1 group" type="button">
          <div :class="['flex items-center justify-center bg-surface-container-high rounded-full text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary transition-all', props.compact ? 'w-10 h-10' : 'w-12 h-12']">
            <span class="material-symbols-outlined text-[20px]">{{ item.icon }}</span>
          </div>
          <span class="text-[10px] font-semibold uppercase text-secondary">{{ item.label }}</span>
        </button>
      </div>
    </div>

    <div :class="['border-b border-outline-variant', props.compact ? 'p-4' : 'p-6']">
      <div :class="['flex justify-between items-center', props.compact ? 'mb-3' : 'mb-4']">
        <h4 class="font-semibold text-on-surface">Shared Media</h4>
        <button class="text-xs text-primary hover:underline" type="button">See all</button>
      </div>
      <div class="grid grid-cols-3 gap-1">
        <div v-for="index in 3" :key="index" class="aspect-square rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
          <span class="material-symbols-outlined">image</span>
        </div>
      </div>
    </div>

    <div :class="['border-b border-outline-variant', props.compact ? 'p-4' : 'p-6']">
      <h4 :class="['font-semibold text-on-surface', props.compact ? 'mb-3' : 'mb-4']">Files & Links</h4>
      <button class="w-full flex items-center gap-4 p-2 rounded-xl hover:bg-surface-container-high transition-colors group text-left" type="button">
        <div class="w-10 h-10 flex items-center justify-center bg-primary-container/50 text-primary rounded-lg group-hover:bg-primary group-hover:text-on-primary">
          <span class="material-symbols-outlined">description</span>
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-on-surface truncate">Conversation notes</p>
          <p class="text-[10px] text-secondary uppercase">Pinned file</p>
        </div>
      </button>
    </div>

    <div :class="props.compact ? 'p-4' : 'p-6'">
      <h4 :class="['font-semibold text-on-surface', props.compact ? 'mb-3' : 'mb-4']">Chat Settings</h4>
      <div class="space-y-1">
        <button
          v-for="item in settingItems"
          :key="item.icon"
          :class="['w-full flex items-center justify-between rounded-xl hover:bg-surface-container-high transition-colors text-on-surface-variant', props.compact ? 'p-1.5' : 'p-2']"
          type="button"
        >
          <div class="flex items-center gap-4">
            <span class="material-symbols-outlined">{{ item.icon }}</span>
            <span class="text-base">{{ item.label }}</span>
          </div>
          <span v-if="item.value" class="text-xs text-secondary">{{ item.value }}</span>
          <span v-else class="material-symbols-outlined text-outline">chevron_right</span>
        </button>

        <button class="w-full flex items-center gap-4 p-2 rounded-xl hover:bg-error-container/20 text-error transition-colors mt-4" type="button">
          <span class="material-symbols-outlined">block</span>
          <span class="text-base font-semibold">Block contact</span>
        </button>
      </div>
    </div>
  </div>
</template>
