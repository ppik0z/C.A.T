<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import type { CallParticipant } from '../../types/call';
import type { CallVideoTrack } from '../../services/call-media.service';

interface Props {
  participant: CallParticipant;
  videoTrack?: CallVideoTrack | null;
  isActiveSpeaker?: boolean;
}

const props = defineProps<Props>();

const videoElement = ref<HTMLVideoElement | null>(null);
let attachedTrack: CallVideoTrack | null = null;

const detachCurrentTrack = () => {
  if (attachedTrack && videoElement.value) {
    attachedTrack.detach(videoElement.value);
  }
  attachedTrack = null;
};

const syncVideoTrack = () => {
  detachCurrentTrack();
  if (!props.videoTrack || !videoElement.value) return;

  attachedTrack = props.videoTrack;
  props.videoTrack.attach(videoElement.value);
  videoElement.value.autoplay = true;
  videoElement.value.playsInline = true;
  videoElement.value.muted = true;
};

watch(() => props.videoTrack, syncVideoTrack);
watch(videoElement, syncVideoTrack);
onBeforeUnmount(detachCurrentTrack);
</script>

<template>
  <div
    class="relative min-h-44 rounded-lg border bg-surface-container-low overflow-hidden flex flex-col items-center justify-center"
    :class="props.isActiveSpeaker ? 'border-primary shadow-[0_0_0_2px_rgba(15,181,130,0.20)]' : 'border-outline-variant'"
  >
    <video
      v-show="props.videoTrack && props.participant.cameraEnabled"
      ref="videoElement"
      class="absolute inset-0 h-full w-full object-cover bg-black"
    />

    <div
      v-if="!props.videoTrack || !props.participant.cameraEnabled"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-surface-container-low"
    >
      <Avatar :avatar-url="props.participant.avatar" :name="props.participant.username" size="xl" />
    </div>

    <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/50 px-3 py-2 text-white backdrop-blur-sm">
      <div class="min-w-0">
        <p class="font-semibold truncate max-w-44">{{ props.participant.username }}</p>
        <p class="text-xs text-white/75">
          <template v-if="props.participant.mediaStatus === 'connecting'">Đang kết nối media</template>
          <template v-else-if="props.participant.mediaStatus === 'reconnecting'">Đang kết nối lại</template>
          <template v-else-if="props.participant.mediaStatus === 'failed'">Lỗi media</template>
          <template v-else-if="props.participant.status === 'joined'">Đang tham gia</template>
          <template v-else-if="props.participant.status === 'ringing'">Đang đổ chuông</template>
          <template v-else-if="props.participant.status === 'declined'">Đã từ chối</template>
          <template v-else-if="props.participant.status === 'missed'">Bị nhỡ</template>
          <template v-else>Đã rời</template>
        </p>
      </div>

      <span class="flex shrink-0 gap-2 text-white/85">
        <span class="material-symbols-outlined text-[18px]">
          {{ props.participant.micEnabled ? 'mic' : 'mic_off' }}
        </span>
        <span class="material-symbols-outlined text-[18px]">
          {{ props.participant.cameraEnabled ? 'videocam' : 'videocam_off' }}
        </span>
      </span>
    </div>
  </div>
</template>
