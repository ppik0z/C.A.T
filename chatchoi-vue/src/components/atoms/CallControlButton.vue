<script setup lang="ts">
import { Mic, MicOff, PhoneOff, ScreenShare, ScreenShareOff, Video, VideoOff } from '@lucide/vue';
import { computed } from 'vue';

interface Props {
  icon: 'mic' | 'mic_off' | 'videocam' | 'videocam_off' | 'screen_share' | 'screen_share_off' | 'call_end';
  label: string;
  active?: boolean;
  tone?: 'neutral' | 'primary' | 'danger';
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  tone: 'neutral',
});

const iconComponent = computed(() => {
  if (props.icon === 'mic') return Mic;
  if (props.icon === 'mic_off') return MicOff;
  if (props.icon === 'videocam') return Video;
  if (props.icon === 'videocam_off') return VideoOff;
  if (props.icon === 'screen_share') return ScreenShare;
  if (props.icon === 'screen_share_off') return ScreenShareOff;
  return PhoneOff;
});
</script>

<template>
  <button
    :aria-label="props.label"
    :title="props.label"
    :class="[
      'flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95',
      props.tone === 'danger'
        ? 'bg-red-500 text-white hover:bg-red-600'
        : props.tone === 'primary'
          ? 'bg-primary text-on-primary hover:brightness-95'
          : props.active
            ? 'bg-white/16 text-white hover:bg-white/24'
            : 'bg-white text-neutral-900 hover:bg-white/90',
    ]"
    type="button"
  >
    <component :is="iconComponent" :size="23" :stroke-width="2.2" />
  </button>
</template>
