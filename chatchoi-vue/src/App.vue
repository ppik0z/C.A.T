<script setup lang="ts">
import { ref, onMounted } from 'vue';
import LoginView from './views/LoginView.vue';
import Sidebar from './components/chat/Sidebar.vue';
import MessageList from './components/chat/MessageList.vue';
import ChatInput from './components/chat/ChatInput.vue';
import { useChatStore } from './stores/chat';
import { initSocketService } from './services/socket.service';

const chatStore = useChatStore();
const isLoggedIn = ref(false);

onMounted(() => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    chatStore.setIdentity(token);
    initSocketService(token);
    isLoggedIn.value = true;
  }
});

chatStore.$subscribe((mutation, state) => {
  if (state.myId) isLoggedIn.value = true;
});
</script>

<template>
  <LoginView v-if="!isLoggedIn" />
  
  <div v-else class="flex h-screen w-screen overflow-hidden font-sans bg-bg-light dark:bg-bg-dark transition-colors duration-300">
    <Sidebar />
    <main class="flex-1 flex flex-col overflow-hidden">
      <MessageList />
      <ChatInput />
    </main>
  </div>
</template>