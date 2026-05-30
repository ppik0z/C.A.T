<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import ChatDetailsDrawer from '../components/organisms/ChatDetailsDrawer.vue';
import CallOverlay from '../components/organisms/CallOverlay.vue';
import ChatPanel from '../components/organisms/ChatPanel.vue';
import ConversationPanel from '../components/organisms/ConversationPanel.vue';
import FriendsPanel from '../components/organisms/FriendsPanel.vue';
import SidebarRail from '../components/organisms/SidebarRail.vue';
import IncomingCallToastStack from '../components/molecules/IncomingCallToastStack.vue';
import CallMiniPlayer from '../components/molecules/CallMiniPlayer.vue';
import { useCallStore } from '../stores/call';
import { useChatStore } from '../stores/chat';
import type { AppSection } from '../types/navigation';

type MobileView = 'list' | 'chat';
const SettingsPanel = defineAsyncComponent(() => import('../components/organisms/SettingsPanel.vue'));

const chatStore = useChatStore();
const callStore = useCallStore();
const activeSection = ref<AppSection>('messages');
const mobileView = ref<MobileView>('list');
const isDetailsOpen = ref(false);
const isMessageSearchOpen = ref(false);

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
</script>

<template>
  <div class="flex h-screen w-full relative bg-background text-on-background overflow-hidden">
    <SidebarRail :active-section="activeSection" @navigate="handleNavigate" />

    <main v-if="activeSection === 'messages'" class="flex flex-1 min-w-0 h-[calc(100dvh-4rem)] overflow-hidden md:h-screen md:pl-20">
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

    <main v-else class="flex flex-1 min-w-0 h-[calc(100dvh-4rem)] overflow-hidden md:h-screen md:pl-20">
      <SettingsPanel class="flex-1" />
    </main>

    <IncomingCallToastStack />
    <CallOverlay />
    <CallMiniPlayer />

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
