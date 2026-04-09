<script setup lang="ts">
import { ref, onMounted } from 'vue';
import LoginView from './views/LoginView.vue';
import Navbar from './components/layout/Navbar.vue';
import ConversationList from './components/layout/ConversationList.vue';
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

chatStore.$subscribe((_, state) => {
  if (state.myId) isLoggedIn.value = true;
});
</script>

<template>
  <LoginView v-if="!isLoggedIn" />
  
  <div v-else class="flex h-screen w-screen overflow-hidden bg-bg-light dark:bg-bg-dark transition-colors duration-300">
    <Navbar />

    <ConversationList />

    <main class="flex-1 flex flex-col min-w-0 bg-white dark:bg-bg-dark">
      <div class="h-16 border-b border-slate-100 dark:border-slate-800 flex items-center px-6">
          <h3 class="font-bold text-slate-700 dark:text-slate-200"># Phòng Số 1</h3>
      </div>
      
      <MessageList />
      <ChatInput />
    </main>
  </div>
</template>