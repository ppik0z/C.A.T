<script setup lang="ts">
import BrandLogo from '../atoms/BrandLogo.vue';
import LoadingListSkeleton from '../molecules/LoadingListSkeleton.vue';
import MessageThreadSkeleton from '../molecules/MessageThreadSkeleton.vue';
</script>

<template>
  <main
    class="flex h-dvh w-full overflow-hidden bg-background text-on-background"
    aria-busy="true"
    aria-live="polite"
  >
    <aside class="hidden h-full w-20 shrink-0 flex-col items-center border-r border-outline-variant bg-surface md:flex">
      <BrandLogo class="mt-7 size-11 rounded-xl" />
      <div class="mt-10 flex flex-col gap-5">
        <div v-for="item in 4" :key="item" class="h-11 w-11 animate-pulse rounded-xl bg-surface-container-high"></div>
      </div>
    </aside>

    <section class="flex h-full min-w-0 flex-1">
      <div class="w-full border-r border-outline-variant bg-surface-container-lowest lg:w-[clamp(300px,30vw,360px)] lg:shrink-0">
        <div class="p-4 sm:p-6">
          <div class="h-9 w-40 animate-pulse rounded-lg bg-surface-container-high"></div>
          <div class="mt-5 h-11 animate-pulse rounded-full bg-surface-container"></div>
          <div class="mt-4 flex gap-2">
            <div v-for="filter in 3" :key="filter" class="h-7 w-20 animate-pulse rounded-full bg-surface-container-high"></div>
          </div>
        </div>
        <LoadingListSkeleton />
      </div>

      <div class="chat-thread-surface hidden min-w-0 flex-1 flex-col lg:flex">
        <div class="flex h-16 items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-5">
          <div class="h-10 w-10 animate-pulse rounded-full bg-surface-container-high"></div>
          <div class="space-y-2">
            <div class="h-3.5 w-36 animate-pulse rounded-full bg-surface-container-high"></div>
            <div class="h-3 w-20 animate-pulse rounded-full bg-surface-container"></div>
          </div>
        </div>
        <div class="flex-1 p-6">
          <MessageThreadSkeleton />
        </div>
        <div class="border-t border-outline-variant bg-surface-container-lowest p-4">
          <div class="h-11 animate-pulse rounded-full bg-surface-container"></div>
        </div>
      </div>
    </section>

    <span class="sr-only">Đang khôi phục phiên đăng nhập và tải dữ liệu...</span>
  </main>
</template>
