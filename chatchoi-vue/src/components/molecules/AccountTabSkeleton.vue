<template>
  <div
    class="grid animate-pulse gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"
    aria-hidden="true"
  >
    <div class="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
      <div class="h-20 bg-surface-container-high"></div>
      <div class="-mt-10 px-5 pb-5">
        <div class="h-20 w-20 rounded-full border-4 border-surface-container-lowest bg-surface-container"></div>
        <div class="mt-4 h-4 w-36 rounded-full bg-surface-container-high"></div>
        <div class="mt-2 h-3 w-24 rounded-full bg-surface-container"></div>
        <div class="mt-5 h-10 rounded-lg bg-surface-container-high"></div>
      </div>
    </div>
    <div class="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
      <div class="h-5 w-44 rounded-full bg-surface-container-high"></div>
      <div class="mt-2 h-3 w-72 max-w-full rounded-full bg-surface-container"></div>
      <div class="mt-8 space-y-5">
        <div v-for="row in 5" :key="row" class="flex items-center gap-4">
          <div class="h-10 w-10 rounded-lg bg-surface-container-high"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3.5 w-32 rounded-full bg-surface-container-high"></div>
            <div class="h-3 w-52 max-w-full rounded-full bg-surface-container"></div>
          </div>
          <div class="h-9 w-24 rounded-lg bg-surface-container-high"></div>
        </div>
      </div>
    </div>
  </div>
</template>
