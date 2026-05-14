<script setup lang="ts">
import Avatar from '../atoms/Avatar.vue';
import FriendActionButton from './FriendActionButton.vue';
import type { FriendUser } from '../../types/friends';

interface Props {
  user: FriendUser;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  add: [userId: number];
  cancel: [userId: number];
  accept: [userId: number];
  reject: [userId: number];
  message: [userId: number];
  remove: [userId: number];
}>();
</script>

<template>
  <article class="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/70 hover:bg-surface-container-low transition-colors">
    <Avatar
      :avatar-url="props.user.avatar"
      :is-online="props.user.isOnline"
      :name="props.user.username"
      :show-status="props.user.relationshipStatus === 'friends'"
      size="lg"
    />

    <div class="min-w-0 flex-1">
      <h3 class="font-bold text-on-surface truncate">{{ props.user.username }}</h3>
      <p class="text-xs font-semibold text-on-surface-variant">
        <span v-if="props.user.relationshipStatus === 'friends'">
          {{ props.user.isOnline ? 'Online' : 'Offline' }}
        </span>
        <span v-else-if="props.user.relationshipStatus === 'incoming_pending'">Sent you a request</span>
        <span v-else-if="props.user.relationshipStatus === 'outgoing_pending'">Request sent</span>
        <span v-else>Suggested for you</span>
      </p>
    </div>

    <FriendActionButton
      :status="props.user.relationshipStatus"
      @accept="emit('accept', props.user.id)"
      @add="emit('add', props.user.id)"
      @cancel="emit('cancel', props.user.id)"
      @message="emit('message', props.user.id)"
      @reject="emit('reject', props.user.id)"
      @remove="emit('remove', props.user.id)"
    />
  </article>
</template>
