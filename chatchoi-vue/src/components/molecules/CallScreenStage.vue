<script setup lang="ts">
import { MonitorUp } from '@lucide/vue';
import { onBeforeUnmount, ref, watch } from 'vue';
import type { CallParticipant } from '../../types/call';
import type { CallVideoTrack } from '../../services/call-media.service';
import { resolveDisplayName } from '../../utils/userPresentation';

interface Props {
  screenTrack: CallVideoTrack;
  sharer: CallParticipant | null;
  isLocal?: boolean;
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
  if (!videoElement.value) return;

  attachedTrack = props.screenTrack;
  props.screenTrack.attach(videoElement.value);
  videoElement.value.autoplay = true;
  videoElement.value.playsInline = true;
  // Tự share màn hình của mình thì tắt tiếng để tránh vọng âm.
  videoElement.value.muted = Boolean(props.isLocal);
};

watch(() => props.screenTrack, syncVideoTrack);
watch(videoElement, syncVideoTrack);
onBeforeUnmount(detachCurrentTrack);
</script>

<template>
  <div class="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-black">
    <video
      ref="videoElement"
      class="h-full w-full object-contain"
    />
    <div class="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
      <MonitorUp :size="14" aria-hidden="true" />
      <span class="truncate">
        {{ props.isLocal ? 'Bạn đang chia sẻ màn hình' : `${props.sharer ? resolveDisplayName(props.sharer) : 'Ai đó'} đang chia sẻ màn hình` }}
      </span>
    </div>
  </div>
</template>
