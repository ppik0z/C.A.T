<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import { useCallMediaStore } from '../../stores/call-media';
import { useCallStore } from '../../stores/call';
import { useChatStore } from '../../stores/chat';
import { getConversationName, getConversationUser } from '../../utils/chatPresentation';
import type { CallVideoTrack } from '../../services/call-media.service';

const callStore    = useCallStore();
const callMediaStore = useCallMediaStore();
const chatStore    = useChatStore();

// ─── Data ─────────────────────────────────────────────────────────────────────
const call         = computed(() => callStore.activeOverlayCall);
const isVisible    = computed(() => Boolean(call.value) && !callStore.isCallExpanded);
const isCollapsed  = ref(false);

const conversation = computed(() =>
  call.value ? chatStore.conversations.find((c) => c.id === call.value!.conversationId) ?? null : null,
);
const title     = computed(() => getConversationName(conversation.value));
const avatarUrl = computed(() => {
  if (!conversation.value) return call.value?.startedBy.avatar ?? null;
  return conversation.value.isGroup
    ? conversation.value.avatarGroup
    : getConversationUser(conversation.value)?.avatar;
});
const localParticipant = computed(() =>
  call.value ? call.value.participants.find((p) => p.userId === chatStore.myId) ?? null : null,
);
const micOn    = computed(() => Boolean(localParticipant.value?.micEnabled));
const cameraOn = computed(() => Boolean(localParticipant.value?.cameraEnabled));
const isTakenOver   = computed(() => callMediaStore.connectionStatus === 'taken_over');
const localVideoTrack = computed<CallVideoTrack | null>(() =>
  call.value && chatStore.myId ? callMediaStore.getVideoTrackForUser(chatStore.myId) : null,
);
const showVideo = computed(() => localVideoTrack.value && cameraOn.value && !isTakenOver.value);

// ─── Video attach/detach ──────────────────────────────────────────────────────
const videoEl = ref<HTMLVideoElement | null>(null);
let attachedTrack: CallVideoTrack | null = null;

const syncVideo = () => {
  if (attachedTrack && videoEl.value) attachedTrack.detach(videoEl.value);
  attachedTrack = null;
  if (!localVideoTrack.value || !videoEl.value) return;
  attachedTrack = localVideoTrack.value;
  localVideoTrack.value.attach(videoEl.value);
  Object.assign(videoEl.value, { autoplay: true, playsInline: true, muted: true });
};
watch(localVideoTrack, syncVideo);
watch(videoEl, syncVideo);
onBeforeUnmount(() => { if (attachedTrack && videoEl.value) attachedTrack.detach(videoEl.value); });

// ─── Drag & drop ──────────────────────────────────────────────────────────────
const MARGIN  = 16;
const playerEl = ref<HTMLElement | null>(null);
const pos      = ref({ right: MARGIN, bottom: MARGIN });
let dragging = false, didMove = false;
let dragStartX = 0, dragStartY = 0, startRight = MARGIN, startBottom = MARGIN;

const onPointerDown = (e: PointerEvent) => {
  if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
  dragging = true; didMove = false;
  dragStartX = e.clientX; dragStartY = e.clientY;
  startRight = pos.value.right; startBottom = pos.value.bottom;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  e.preventDefault();
};

const onPointerMove = (e: PointerEvent) => {
  if (!dragging || !playerEl.value) return;
  const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didMove = true;
  const { offsetWidth: w, offsetHeight: h } = playerEl.value;
  pos.value = {
    right:  Math.max(MARGIN, Math.min(window.innerWidth  - w - MARGIN, startRight  - dx)),
    bottom: Math.max(MARGIN, Math.min(window.innerHeight - h - MARGIN, startBottom - dy)),
  };
};

const onPointerUp = () => {
  if (!dragging) return;
  dragging = false;
  if (!didMove && isCollapsed.value) isCollapsed.value = false;
};

const clampToViewport = () => {
  if (!playerEl.value) return;
  const { offsetWidth: w, offsetHeight: h } = playerEl.value;
  pos.value = {
    right:  Math.max(MARGIN, Math.min(window.innerWidth  - w - MARGIN, pos.value.right)),
    bottom: Math.max(MARGIN, Math.min(window.innerHeight - h - MARGIN, pos.value.bottom)),
  };
};
onMounted(()       => window.addEventListener('resize', clampToViewport));
onBeforeUnmount(() => window.removeEventListener('resize', clampToViewport));

// ─── Actions ──────────────────────────────────────────────────────────────────
const handleExpand = () => { callStore.isCallExpanded = true; };

const handleToggleMic = () => {
  if (!call.value || isTakenOver.value) return;
  call.value.provider === 'livekit' && callMediaStore.activeCallId === call.value.id
    ? void callMediaStore.setMicEnabled(call.value.id, !micOn.value)
    : callStore.toggleMic(call.value.id);
};

const handleToggleCamera = () => {
  if (!call.value || isTakenOver.value) return;
  call.value.provider === 'livekit' && callMediaStore.activeCallId === call.value.id
    ? void callMediaStore.setCameraEnabled(call.value.id, !cameraOn.value)
    : callStore.toggleCamera(call.value.id);
};

const handleLeave = () => {
  if (!call.value) return;
  void callMediaStore.disconnectForCall(call.value.id);
  callStore.leaveCall(call.value.id);
};
</script>

<template>
  <Teleport to="body">
    <!-- Mount/unmount animation -->
    <Transition
      enter-active-class="transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      enter-from-class="opacity-0 scale-75 translate-y-4"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-90 translate-y-2"
    >
      <div
        v-if="isVisible && call"
        ref="playerEl"
        class="fixed z-40 select-none touch-none"
        :style="{ right: `${pos.right}px`, bottom: `${pos.bottom}px` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >
        <!-- Pill ↔ Minimize switch animation -->
        <Transition
          enter-active-class="transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          enter-from-class="opacity-0 scale-90"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-90"
          mode="out-in"
        >

          <!-- ══ PILL ════════════════════════════════════════════════════════ -->
          <div
            v-if="isCollapsed"
            class="flex items-center h-10 rounded-full shadow-lg overflow-hidden
                   bg-neutral-900/90 backdrop-blur-xl border border-white/10 ring-1 ring-black/5"
          >
            <!-- Tappable name area → expand to minimize -->
            <button
              class="flex items-center gap-2 pl-2.5 pr-2 h-full hover:bg-white/5 transition-colors"
              type="button"
              :aria-label="`Mở cuộc gọi với ${title}`"
              @click="isCollapsed = false"
            >
              <span class="relative flex h-2 w-2 shrink-0">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span class="text-[13px] font-medium text-white/90 max-w-[90px] truncate">{{ title }}</span>
            </button>

            <div class="w-px h-4 bg-white/10 shrink-0" />

            <!-- Controls -->
            <div class="flex items-center px-1">
              <button
                class="h-9 w-9 rounded-full flex items-center justify-center transition-colors"
                :class="micOn ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-red-400'"
                type="button"
                :aria-label="micOn ? 'Tắt micro' : 'Bật micro'"
                @click.stop="handleToggleMic"
              >
                <span class="material-symbols-outlined text-[18px]">{{ micOn ? 'mic' : 'mic_off' }}</span>
              </button>

              <button
                class="h-9 w-9 rounded-full flex items-center justify-center transition-colors"
                :class="cameraOn ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-red-400'"
                type="button"
                :aria-label="cameraOn ? 'Tắt camera' : 'Bật camera'"
                @click.stop="handleToggleCamera"
              >
                <span class="material-symbols-outlined text-[18px]">{{ cameraOn ? 'videocam' : 'videocam_off' }}</span>
              </button>

              <button
                class="h-7 w-7 mx-1 rounded-full bg-red-500 hover:bg-red-600 text-white
                       flex items-center justify-center transition-colors shrink-0"
                type="button"
                aria-label="Rời cuộc gọi"
                @click.stop="handleLeave"
              >
                <span class="material-symbols-outlined text-[15px]">call_end</span>
              </button>
            </div>
          </div>

          <!-- ══ MINIMIZE ═══════════════════════════════════════════════════ -->
          <div
            v-else
            class="relative w-56 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/20 cursor-pointer"
            style="aspect-ratio: 4/3"
            @click="handleExpand"
          >
            <!-- Media layer -->
            <video
              v-show="showVideo"
              ref="videoEl"
              class="absolute inset-0 w-full h-full object-cover bg-neutral-900"
            />
            <div
              v-if="!showVideo"
              class="absolute inset-0 flex items-center justify-center bg-neutral-900"
            >
              <Avatar :avatar-url="avatarUrl" :name="title" size="lg" />
            </div>

            <!-- Top overlay: drag indicator + action buttons -->
            <div
              class="absolute inset-x-0 top-0 flex items-start justify-between px-2 pt-2 pb-6
                     bg-gradient-to-b from-black/55 to-transparent pointer-events-none"
            >
              <!-- Drag handle -->
              <div class="flex-1 flex justify-center pt-1 pointer-events-auto cursor-grab active:cursor-grabbing">
                <div class="h-0.5 w-7 rounded-full bg-white/30" />
              </div>

              <!-- Action buttons (pointer-events re-enabled) -->
              <div class="flex gap-1 pointer-events-auto" @click.stop>
                <button
                  class="h-7 w-7 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm
                         text-white/80 hover:text-white flex items-center justify-center transition-all"
                  type="button"
                  aria-label="Mở rộng"
                  @click.stop="handleExpand"
                >
                  <span class="material-symbols-outlined text-[14px]">open_in_full</span>
                </button>
                <button
                  class="h-7 w-7 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm
                         text-white/80 hover:text-white flex items-center justify-center transition-all"
                  type="button"
                  aria-label="Thu nhỏ tối đa"
                  @click.stop="isCollapsed = true"
                >
                  <span class="material-symbols-outlined text-[14px]">remove</span>
                </button>
              </div>
            </div>

            <!-- Taken over notice -->
            <div
              v-if="isTakenOver"
              class="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center px-4"
            >
              <p class="text-[11px] text-white/75 bg-black/40 rounded-lg px-3 py-1.5 backdrop-blur-sm inline-block">
                Đang hoạt động ở nơi khác
              </p>
            </div>

            <!-- Bottom overlay: info + controls -->
            <div
              class="absolute inset-x-0 bottom-0 px-3 pt-6 pb-2.5
                     bg-gradient-to-t from-black/65 to-transparent pointer-events-none"
              @click.stop
            >
              <div class="flex items-end justify-between pointer-events-auto">
                <!-- Call info -->
                <div class="min-w-0">
                  <p class="text-[11px] font-medium text-white/60 truncate">
                    {{ call.kind === 'video' ? 'Video' : 'Thoại' }} · {{ call.activeParticipantCount }} người
                  </p>
                </div>

                <!-- Controls -->
                <div class="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    class="h-8 w-8 rounded-full flex items-center justify-center transition-all"
                    :class="micOn
                      ? 'bg-white/15 hover:bg-white/25 text-white'
                      : 'bg-red-500/80 hover:bg-red-500 text-white'"
                    type="button"
                    :aria-label="micOn ? 'Tắt micro' : 'Bật micro'"
                    @click.stop="handleToggleMic"
                  >
                    <span class="material-symbols-outlined text-[16px]">{{ micOn ? 'mic' : 'mic_off' }}</span>
                  </button>

                  <button
                    class="h-8 w-8 rounded-full flex items-center justify-center transition-all"
                    :class="cameraOn
                      ? 'bg-white/15 hover:bg-white/25 text-white'
                      : 'bg-red-500/80 hover:bg-red-500 text-white'"
                    type="button"
                    :aria-label="cameraOn ? 'Tắt camera' : 'Bật camera'"
                    @click.stop="handleToggleCamera"
                  >
                    <span class="material-symbols-outlined text-[16px]">{{ cameraOn ? 'videocam' : 'videocam_off' }}</span>
                  </button>

                  <button
                    class="h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 text-white
                           flex items-center justify-center transition-all"
                    type="button"
                    aria-label="Rời cuộc gọi"
                    @click.stop="handleLeave"
                  >
                    <span class="material-symbols-outlined text-[16px]">call_end</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
