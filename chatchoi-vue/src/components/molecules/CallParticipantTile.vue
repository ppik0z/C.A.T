<script setup lang="ts">
import Avatar from '../atoms/Avatar.vue';
import type { CallParticipant } from '../../types/call';

interface Props {
  participant: CallParticipant;
}

const props = defineProps<Props>();
</script>

<template>
  <div class="min-h-32 rounded-lg bg-surface-container-low border border-outline-variant flex flex-col items-center justify-center gap-3 p-4">
    <Avatar :avatar-url="props.participant.avatar" :name="props.participant.username" size="xl" />
    <div class="min-w-0 text-center">
      <p class="font-semibold text-on-surface truncate max-w-40">{{ props.participant.username }}</p>
      <p class="text-xs text-secondary">
        <template v-if="props.participant.status === 'joined'">Đang tham gia</template>
        <template v-else-if="props.participant.status === 'ringing'">Đang đổ chuông</template>
        <template v-else-if="props.participant.status === 'declined'">Đã từ chối</template>
        <template v-else-if="props.participant.status === 'missed'">Bị nhỡ</template>
        <template v-else>Đã rời</template>
      </p>
    </div>
    <div class="flex gap-2 text-secondary">
      <span class="material-symbols-outlined text-[18px]">
        {{ props.participant.micEnabled ? 'mic' : 'mic_off' }}
      </span>
      <span class="material-symbols-outlined text-[18px]">
        {{ props.participant.cameraEnabled ? 'videocam' : 'videocam_off' }}
      </span>
    </div>
  </div>
</template>
