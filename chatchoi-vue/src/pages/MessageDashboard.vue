<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import ChatDetailsDrawer from '../components/organisms/ChatDetailsDrawer.vue';
import CallOverlay from '../components/organisms/CallOverlay.vue';
import ChatPanel from '../components/organisms/ChatPanel.vue';
import ConversationPanel from '../components/organisms/ConversationPanel.vue';
import FriendsPanel from '../components/organisms/FriendsPanel.vue';
import SidebarRail from '../components/organisms/SidebarRail.vue';
import IncomingCallToastStack from '../components/molecules/IncomingCallToastStack.vue';
import NotificationToastStack from '../components/molecules/NotificationToastStack.vue';
import CallMiniPlayer from '../components/molecules/CallMiniPlayer.vue';
import PushNotificationBanner from '../components/molecules/PushNotificationBanner.vue';
import { useCallStore } from '../stores/call';
import { useChatStore } from '../stores/chat';
import type { AppSection } from '../types/navigation';
import { pushNavigateEvent, pushOpenConversationEvent, takePendingPushConversationId } from '../pwa/pwaRuntime';

type MobileView = 'list' | 'chat';
const SettingsPanel = defineAsyncComponent(() => import('../components/organisms/SettingsPanel.vue'));

const chatStore = useChatStore();
const callStore = useCallStore();
const activeSection = ref<AppSection>('messages');
const mobileView = ref<MobileView>('list');
const isDetailsOpen = ref(false);
const isMessageSearchOpen = ref(false);
const pendingConversationId = ref<number | null>(null);

const currentConversation = computed(() => {
  return chatStore.conversations.find((conversation) => conversation.id === chatStore.currentConversationId) ?? null;
});

const showMobileChat = computed(() => mobileView.value === 'chat' && Boolean(currentConversation.value));

watch(
  () => chatStore.currentConversationId,
  () => {
    isDetailsOpen.value = false;
    isMessageSearchOpen.value = false;
  },
);

const handleConversationSelected = () => {
  mobileView.value = 'chat';
};

const handleBackToList = () => {
  mobileView.value = 'list';
  isDetailsOpen.value = false;
  isMessageSearchOpen.value = false;
};

const handleNavigate = (section: AppSection) => {
  activeSection.value = section;
  if (section !== 'messages') {
    isDetailsOpen.value = false;
    isMessageSearchOpen.value = false;
    mobileView.value = 'list';
  }
};

const handleOpenMessages = () => {
  activeSection.value = 'messages';
  mobileView.value = 'chat';
};

const handleOpenMessageSearch = () => {
  isDetailsOpen.value = false;
  isMessageSearchOpen.value = true;
  mobileView.value = 'chat';
};

const openPendingConversation = () => {
  const conversationId = pendingConversationId.value;
  if (!conversationId || !chatStore.conversations.some((conversation) => conversation.id === conversationId)) return;

  chatStore.selectConversation(conversationId);
  callStore.requestConversationActiveCall(conversationId);
  activeSection.value = 'messages';
  mobileView.value = 'chat';
  pendingConversationId.value = null;

  const url = new URL(window.location.href);
  url.searchParams.delete('conversationId');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
};

const setPendingConversation = (value: unknown) => {
  const conversationId = typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isInteger(conversationId) || conversationId <= 0) return;

  pendingConversationId.value = conversationId;
  openPendingConversation();
};

const handlePushOpenConversation = (event: Event) => {
  setPendingConversation((event as CustomEvent<{ conversationId?: string }>).detail?.conversationId);
};

const navigateToLink = (link: string) => {
  try {
    const url = new URL(link, window.location.origin);
    const conversationId = url.searchParams.get('conversationId');
    if (conversationId) {
      setPendingConversation(conversationId);
      return;
    }
    if (url.searchParams.get('view') === 'friends') {
      handleNavigate('friends');
    }
  } catch {
    // link không hợp lệ -> bỏ qua, app vẫn ở màn hình hiện tại
  }
};

const handlePushNavigate = (event: Event) => {
  const link = (event as CustomEvent<{ link?: string }>).detail?.link;
  if (typeof link === 'string') navigateToLink(link);
};

watch(() => chatStore.conversations.length, openPendingConversation);

onMounted(() => {
  const params = new URL(window.location.href).searchParams;
  setPendingConversation(params.get('conversationId'));
  setPendingConversation(takePendingPushConversationId());
  if (params.get('view') === 'friends') handleNavigate('friends');
  window.addEventListener(pushOpenConversationEvent, handlePushOpenConversation);
  window.addEventListener(pushNavigateEvent, handlePushNavigate);
});

onUnmounted(() => {
  window.removeEventListener(pushOpenConversationEvent, handlePushOpenConversation);
  window.removeEventListener(pushNavigateEvent, handlePushNavigate);
});
</script>

<template>
  <div class="flex h-dvh w-full relative bg-background text-on-background overflow-hidden md:h-screen">
    <SidebarRail
      :active-section="activeSection"
      :hide-mobile="showMobileChat"
      @navigate="handleNavigate"
    />

    <main
      v-if="activeSection === 'messages'"
      :class="[
        'flex flex-1 min-w-0 overflow-hidden md:h-screen md:pl-20',
        showMobileChat ? 'h-dvh' : 'h-[calc(100dvh-4rem)]',
      ]"
    >
      <div
        :class="[
          'h-full min-w-0 w-full lg:w-[clamp(300px,30vw,360px)] lg:shrink-0',
          showMobileChat ? 'hidden lg:block' : 'block',
        ]"
      >
        <ConversationPanel @selected="handleConversationSelected" />
      </div>

      <div
        :class="[
          'h-full min-w-0 flex-1',
          showMobileChat ? 'block' : 'hidden lg:block',
        ]"
      >
        <ChatPanel
          :conversation="currentConversation"
          :details-open="isDetailsOpen"
          :search-open="isMessageSearchOpen"
          @back="handleBackToList"
          @close-search="isMessageSearchOpen = false"
          @toggle-details="isDetailsOpen = !isDetailsOpen"
        />
      </div>

      <ChatDetailsDrawer
        :conversation="currentConversation"
        :is-open="Boolean(currentConversation) && isDetailsOpen"
        @close="isDetailsOpen = false"
        @open-message-search="handleOpenMessageSearch"
      />
    </main>

    <main v-else-if="activeSection === 'friends'" class="flex flex-1 min-w-0 h-[calc(100dvh-4rem)] overflow-hidden md:h-screen md:pl-20">
      <FriendsPanel class="flex-1" @open-messages="handleOpenMessages" />
    </main>

    <main v-else-if="activeSection === 'settings' || activeSection === 'account'" class="flex flex-1 min-w-0 h-[calc(100dvh-4rem)] overflow-hidden md:h-screen md:pl-20">
      <SettingsPanel class="flex-1" :initial-tab="activeSection === 'account' ? 'account' : 'appearance'" />
    </main>

    <IncomingCallToastStack />
    <NotificationToastStack />
    <CallOverlay />
    <CallMiniPlayer />
    <PushNotificationBanner />

    <button
      v-if="callStore.callError"
      class="fixed bottom-4 right-4 z-50 max-w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-error/30 bg-error-container px-4 py-3 text-left text-sm font-semibold text-error shadow-lg"
      type="button"
      @click="callStore.dismissError"
    >
      {{ callStore.callError }}
    </button>
  </div>
</template>
