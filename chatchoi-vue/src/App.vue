<script setup lang="ts">
import { onMounted, ref } from 'vue';
import LoginView from './views/LoginView.vue';
import MessageDashboard from './pages/MessageDashboard.vue';
import { useChatStore } from './stores/chat';
import { useFriendsStore } from './stores/friends';
import { initSocketService } from './services/socket.service';

const chatStore = useChatStore();
const friendsStore = useFriendsStore();
const isLoggedIn = ref(false);

onMounted(() => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    chatStore.setIdentity(token);
    initSocketService(token);
    void friendsStore.refreshAll();
    isLoggedIn.value = true;
  }
});

chatStore.$subscribe((_, state) => {
  if (state.myId) isLoggedIn.value = true;
});
</script>

<template>
  <LoginView v-if="!isLoggedIn" />
  <MessageDashboard v-else />
</template>
