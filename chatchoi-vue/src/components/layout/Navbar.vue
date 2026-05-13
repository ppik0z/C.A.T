<script setup lang="ts">
import { useChatStore } from '../../stores/chat';
const chatStore = useChatStore();

const handleLogout = () => {
  localStorage.removeItem('accessToken');
  window.location.reload();
};
</script>

<template>
  <aside class="left-sidebar z-50 h-screen bg-surface flex flex-col border-r border-outline-variant shadow-lg">
    <div class="flex flex-col items-start px-4 py-8 gap-8">
      <div class="flex items-center gap-4">
        <div class="min-w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-sm">
          <span class="material-symbols-outlined !text-[24px]">hub</span>
        </div>
        <span class="sidebar-label text-xl font-bold text-primary">CHATCHOI</span>
      </div>
    </div>

    <nav class="flex-1 flex flex-col items-start gap-4 px-4">
      <a class="flex items-center gap-4 w-full h-12 rounded-xl transition-all duration-200 text-primary bg-primary-container" href="#">
        <div class="min-w-12 h-12 flex items-center justify-center">
          <span class="material-symbols-outlined !text-[24px]">chat</span>
        </div>
        <span class="sidebar-label font-semibold">Messages</span>
      </a>

      <a class="flex items-center gap-4 w-full h-12 rounded-xl transition-all duration-200 text-on-surface-variant hover:bg-surface-container-high" href="#">
        <div class="min-w-12 h-12 flex items-center justify-center">
          <span class="material-symbols-outlined !text-[24px]">group</span>
        </div>
        <span class="sidebar-label font-semibold">Contacts</span>
      </a>

      <a class="flex items-center gap-4 w-full h-12 rounded-xl transition-all duration-200 text-on-surface-variant hover:bg-surface-container-high" href="#">
        <div class="min-w-12 h-12 flex items-center justify-center">
          <span class="material-symbols-outlined !text-[24px]">folder_open</span>
        </div>
        <span class="sidebar-label font-semibold">Files</span>
      </a>

      <a class="flex items-center gap-4 w-full h-12 rounded-xl transition-all duration-200 text-on-surface-variant hover:bg-surface-container-high" href="#">
        <div class="min-w-12 h-12 flex items-center justify-center">
          <span class="material-symbols-outlined !text-[24px]">settings</span>
        </div>
        <span class="sidebar-label font-semibold">Settings</span>
      </a>
    </nav>

    <div class="mt-auto flex flex-col items-start py-6 border-t border-outline-variant gap-4 px-4">
      <button class="flex items-center gap-4 w-full h-12 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-all" type="button">
        <div class="min-w-12 h-12 flex items-center justify-center">
          <span class="material-symbols-outlined !text-[24px]">help</span>
        </div>
        <span class="sidebar-label font-semibold">Support</span>
      </button>

      <button @click="handleLogout" class="flex items-center gap-4 w-full h-12 rounded-xl text-error hover:bg-error-container/40 transition-all" title="Đăng xuất" type="button">
        <div class="min-w-12 h-12 flex items-center justify-center">
          <span class="material-symbols-outlined !text-[24px]">logout</span>
        </div>
        <span class="sidebar-label font-semibold">Logout</span>
      </button>

      <div class="flex items-center gap-4 w-full">
        <div class="min-w-12 flex items-center justify-center">
          <div class="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold border-2 border-primary-container">
            {{ chatStore.myUserName?.[0]?.toUpperCase() ?? chatStore.myId ?? 'U' }}
          </div>
        </div>
        <div class="sidebar-label flex flex-col">
          <span class="font-semibold text-on-surface leading-tight">{{ chatStore.myUserName ?? 'User' }}</span>
          <span class="text-[10px] text-on-surface-variant opacity-70">Online</span>
        </div>
      </div>
    </div>
  </aside>
</template>
