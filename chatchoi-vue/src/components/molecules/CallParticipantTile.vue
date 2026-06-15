<script setup lang="ts">
import { Mic, MicOff, Video, VideoOff } from '@lucide/vue';
import { onBeforeUnmount, ref, watch } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import { resolveDisplayName } from '../../utils/userPresentation';
import type { CallParticipant } from '../../types/call';
import type { CallVideoTrack } from '../../services/call-media.service';

interface Props {
  participant: CallParticipant;
  videoTrack?: CallVideoTrack | null;
  isActiveSpeaker?: boolean;
  compact?: boolean;
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
    :class="[
      'relative overflow-hidden border bg-neutral-900 flex flex-col items-center justify-center',
      props.compact ? 'h-full min-h-0 rounded-2xl' : 'min-h-48 rounded-[1.5rem]',
      props.isActiveSpeaker
        ? 'border-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_55%,transparent)]'
        : 'border-white/10',
    ]"
  >
    <video
      v-show="props.videoTrack && props.participant.cameraEnabled"
      ref="videoElement"
      class="absolute inset-0 h-full w-full object-cover bg-black"
    />

    <div
      v-if="!props.videoTrack || !props.participant.cameraEnabled"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.12),transparent_58%)] p-4"
    >
      <Avatar
        :avatar-url="props.participant.avatar"
        :name="props.participant.username"
        :size="props.compact ? 'lg' : 'xl'"
      />
    </div>

    <div
      :class="[
        'absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/35 to-transparent text-white',
        props.compact ? 'px-2 pb-2 pt-8' : 'px-3 pb-3 pt-12',
      ]"
    >
      <div class="min-w-0">
        <p :class="['truncate font-semibold', props.compact ? 'max-w-20 text-xs' : 'max-w-44']">
          {{ resolveDisplayName(props.participant) }}
        </p>
        <p v-if="!props.compact" class="text-xs text-white/75">
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

      <span
        v-if="!props.compact"
        class="flex shrink-0 gap-2 rounded-full bg-black/35 px-2 py-1 text-white/90 backdrop-blur-sm"
      >
        <Mic v-if="props.participant.micEnabled" :size="15" />
        <MicOff v-else :size="15" />
        <Video v-if="props.participant.cameraEnabled" :size="15" />
        <VideoOff v-else :size="15" />
      </span>
    </div>
  </div>
</template>
