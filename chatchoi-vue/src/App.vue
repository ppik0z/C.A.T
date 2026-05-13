<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import LoginView from './views/LoginView.vue';
import Navbar from './components/layout/Navbar.vue';
import ConversationList from './components/layout/ConversationList.vue';
import MessageList from './components/chat/MessageList.vue';
import ChatInput from './components/chat/ChatInput.vue';
import ChatDetails from './components/chat/ChatDetails.vue';
import { useChatStore } from './stores/chat';
import { initSocketService } from './services/socket.service';
import type { Conversation } from './types/chat';

const chatStore = useChatStore();
const isLoggedIn = ref(false);
const isDetailsOpen = ref(true);

const currentConversation = computed(() => {
  return chatStore.conversations.find((conversation) => conversation.id === chatStore.currentConversationId) ?? null;
});

const getConversationName = (conversation: Conversation | null) => {
  if (!conversation) return 'Chọn một đoạn chat';
  return conversation.isGroup
    ? conversation.name ?? `Nhóm #${conversation.id}`
    : conversation.friend?.username ?? `Chat #${conversation.id}`;
};

const getConversationInitials = (conversation: Conversation | null) => {
  return getConversationName(conversation)
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

onMounted(() => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    chatStore.setIdentity(token);
    initSocketService(token);
    isLoggedIn.value = true;
  }
});

chatStore.$subscribe((_, state) => {
  if (state.myId) isLoggedIn.value = true;
});
</script>

<template>
  <LoginView v-if="!isLoggedIn" />

  <div v-else class="flex h-screen w-full relative bg-background text-on-background overflow-hidden">
    <Navbar />

    <div class="flex flex-1 ml-[80px] h-screen overflow-hidden w-[calc(100vw-80px)]">
      <ConversationList />

      <section class="flex-1 h-full flex flex-col bg-surface overflow-hidden relative">
        <template v-if="currentConversation">
          <header class="flex justify-between items-center px-6 py-4 border-b border-outline-variant bg-surface-container-lowest sticky top-0 z-30">
            <div class="flex items-center gap-4 min-w-0">
              <div class="relative shrink-0">
                <div class="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold overflow-hidden">
                  <img
                    v-if="currentConversation.friend?.avatar"
                    :alt="getConversationName(currentConversation)"
                    :src="currentConversation.friend.avatar"
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ getConversationInitials(currentConversation) }}</span>
                </div>
                <span
                  v-if="currentConversation.isOnline"
                  class="absolute bottom-0 right-0 w-3 h-3 bg-secondary border-2 border-white rounded-full"
                />
              </div>

              <div class="min-w-0">
                <h2 class="text-xl leading-7 font-bold text-primary truncate">{{ getConversationName(currentConversation) }}</h2>
                <p class="text-xs font-semibold text-secondary">{{ currentConversation.isOnline ? 'Active now' : 'Offline' }}</p>
              </div>
            </div>

            <div class="flex items-center gap-2 md:gap-4">
              <button class="w-10 h-10 flex items-center justify-center text-secondary hover:text-primary transition-colors hover:bg-surface-container-high rounded-full" type="button">
                <span class="material-symbols-outlined text-[22px]">call</span>
              </button>
              <button class="w-10 h-10 flex items-center justify-center text-secondary hover:text-primary transition-colors hover:bg-surface-container-high rounded-full" type="button">
                <span class="material-symbols-outlined text-[22px]">videocam</span>
              </button>
              <div class="w-px h-6 bg-outline-variant mx-1 md:mx-2"></div>
              <button
                :class="[
                  'w-10 h-10 flex items-center justify-center transition-colors rounded-full',
                  isDetailsOpen ? 'bg-surface-container-high text-primary' : 'text-secondary hover:text-primary hover:bg-surface-container-high',
                ]"
                type="button"
                @click="isDetailsOpen = !isDetailsOpen"
              >
                <span class="material-symbols-outlined text-[22px]">info</span>
              </button>
            </div>
          </header>

          <MessageList />
          <ChatInput />
        </template>

        <div v-else class="flex-1 flex flex-col items-center justify-center text-on-surface-variant bg-background/50">
          <div class="w-20 h-20 rounded-full bg-primary-container text-primary flex items-center justify-center mb-4">
            <span class="material-symbols-outlined text-[40px]">chat</span>
          </div>
          <h2 class="text-xl font-bold mb-2 text-on-surface">Chào mừng</h2>
          <p class="text-sm">Hãy chọn một đoạn chat để bắt đầu gửi tin nhắn</p>
        </div>
      </section>

      <ChatDetails :conversation="currentConversation" :is-open="Boolean(currentConversation) && isDetailsOpen" />
    </div>
  </div>
</template>
