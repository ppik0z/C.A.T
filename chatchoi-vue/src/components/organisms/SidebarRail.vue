<script setup lang="ts">
import { useChatStore } from '../../stores/chat';

const chatStore = useChatStore();

const handleLogout = () => {
  localStorage.removeItem('accessToken');
  window.location.reload();
};

const navItems = [
  { icon: 'chat', label: 'Messages', active: true },
  { icon: 'group', label: 'Contacts', active: false },
  { icon: 'folder_open', label: 'Files', active: false },
  { icon: 'settings', label: 'Settings', active: false },
];
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-50 h-16 bg-surface-container-lowest border-t border-outline-variant shadow-[0_-8px_24px_rgba(10,27,53,0.08)] md:hidden">
    <div class="h-full grid grid-cols-5 items-center px-2">
      <a
        v-for="item in navItems"
        :key="item.icon"
        :class="[
          'h-12 flex flex-col items-center justify-center rounded-xl text-[10px] font-semibold transition-colors',
          item.active ? 'text-primary bg-primary-container/50' : 'text-on-surface-variant',
        ]"
        href="#"
      >
        <span class="material-symbols-outlined !text-[22px]">{{ item.icon }}</span>
        <span class="leading-none">{{ item.label }}</span>
      </a>

      <button class="h-12 flex flex-col items-center justify-center rounded-xl text-[10px] font-semibold text-error" type="button" @click="handleLogout">
        <span class="material-symbols-outlined !text-[22px]">logout</span>
        <span class="leading-none">Logout</span>
      </button>
    </div>
  </nav>

  <aside class="left-sidebar hidden md:flex z-50 h-screen bg-surface flex-col border-r border-outline-variant shadow-lg">
    <div class="flex flex-col items-start px-4 py-8 gap-8">
      <div class="flex items-center gap-4">
        <div class="min-w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-sm">
          <span class="material-symbols-outlined !text-[24px]">hub</span>
        </div>
        <span class="sidebar-label text-xl font-bold text-primary">CHATCHOI</span>
      </div>
    </div>

    <nav class="flex-1 flex flex-col items-start gap-4 px-4">
      <a
        v-for="item in navItems"
        :key="item.icon"
        :class="[
          'flex items-center gap-4 w-full h-12 rounded-xl transition-all duration-200',
          item.active ? 'text-primary bg-primary-container' : 'text-on-surface-variant hover:bg-surface-container-high',
        ]"
        href="#"
      >
        <div class="min-w-12 h-12 flex items-center justify-center">
          <span class="material-symbols-outlined !text-[24px]">{{ item.icon }}</span>
        </div>
        <span class="sidebar-label font-semibold">{{ item.label }}</span>
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
          <span class="text-[10px] text-emerald-600 font-semibold">Online</span>
        </div>
      </div>
    </div>
  </aside>
</template>
