<script setup lang="ts">
import { useChatStore } from '../../stores/chat';
import { nextTick, ref, watch } from 'vue';

const chatStore = useChatStore();
const scrollRef = ref<HTMLElement | null>(null);

// Tự động cuộn xuống khi có tin nhắn mới
watch(() => chatStore.messages.length, async () => {
  await nextTick();
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
  }
});
</script>

<template>
  <section class="flex-1 p-6 overflow-y-auto space-y-6 bg-bg-light dark:bg-bg-dark transition-colors duration-300">
    <div v-for="msg in chatStore.messages" :key="msg.id" 
         :class="['flex w-full animate-slide-in', msg.senderId === 29 ? 'justify-end' : 'justify-start']">
      
      <div :class="[
        'max-w-[70%] p-4 rounded-2xl shadow-sm transition-all hover:shadow-md',
        msg.senderId === 29 
          ? 'bg-primary text-white rounded-tr-none' 
          : 'bg-white dark:bg-surface-dark text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800'
      ]">
        <p class="text-[11px] font-medium opacity-70 mb-1 uppercase tracking-wider">
          {{ msg.sender?.username }}
        </p>
        <p class="text-[15px] leading-relaxed">{{ msg.content }}</p>
      </div>
      
    </div>
  </section>
</template>

<style scoped>
@keyframes slide-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-slide-in { animation: slide-in 0.3s ease-out; }
</style>