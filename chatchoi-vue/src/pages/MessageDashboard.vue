<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ChatDetailsDrawer from '../components/organisms/ChatDetailsDrawer.vue';
import ChatPanel from '../components/organisms/ChatPanel.vue';
import ConversationPanel from '../components/organisms/ConversationPanel.vue';
import FriendsPanel from '../components/organisms/FriendsPanel.vue';
import SidebarRail from '../components/organisms/SidebarRail.vue';
import { useChatStore } from '../stores/chat';

type MobileView = 'list' | 'chat';
type AppSection = 'messages' | 'friends';

const chatStore = useChatStore();
const activeSection = ref<AppSection>('messages');
const mobileView = ref<MobileView>('list');
const isDetailsOpen = ref(false);

const currentConversation = computed(() => {
  return chatStore.conversations.find((conversation) => conversation.id === chatStore.currentConversationId) ?? null;
});

const showMobileChat = computed(() => mobileView.value === 'chat' && Boolean(currentConversation.value));

watch(
  () => chatStore.currentConversationId,
  () => {
    isDetailsOpen.value = false;
  },
);

const handleConversationSelected = () => {
  mobileView.value = 'chat';
};

const handleBackToList = () => {
  mobileView.value = 'list';
  isDetailsOpen.value = false;
};

const handleNavigate = (section: AppSection) => {
  activeSection.value = section;
  if (section === 'friends') {
    isDetailsOpen.value = false;
    mobileView.value = 'list';
  }
};

const handleOpenMessages = () => {
  activeSection.value = 'messages';
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
          @back="handleBackToList"
          @toggle-details="isDetailsOpen = !isDetailsOpen"
        />
      </div>

      <ChatDetailsDrawer
        :conversation="currentConversation"
        :is-open="Boolean(currentConversation) && isDetailsOpen"
        @close="isDetailsOpen = false"
      />
    </main>

    <main v-else class="flex flex-1 min-w-0 h-[calc(100dvh-4rem)] overflow-hidden md:h-screen md:pl-20">
      <FriendsPanel class="flex-1" @open-messages="handleOpenMessages" />
    </main>
  </div>
</template>
