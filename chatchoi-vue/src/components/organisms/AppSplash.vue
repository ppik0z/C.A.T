<template>
  <div
    class="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background"
    aria-busy="true"
    aria-live="polite"
  >
    <img
      alt="ChatChoi"
      class="size-20 rounded-2xl"
      height="512"
      src="/pwa/cat-icon.svg"
      width="512"
    />
    <div class="flex items-center gap-1.5">
      <span class="splash-dot size-2 rounded-full bg-primary" />
      <span class="splash-dot size-2 rounded-full bg-primary [animation-delay:150ms]" />
      <span class="splash-dot size-2 rounded-full bg-primary [animation-delay:300ms]" />
    </div>
    <span class="sr-only">Đang khôi phục phiên đăng nhập...</span>
  </div>
</template>

<style scoped>
.splash-dot {
  animation: splash-bounce 1.2s ease-in-out infinite;
}

@keyframes splash-bounce {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  30% {
    opacity: 1;
    transform: scale(1.3);
  }
}
</style>
