<template>
  <div class="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 max-w-sm">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        @click="toastStore.removeToast(toast.id)"
        :class="[
          'px-4 py-3 rounded-lg shadow-lg cursor-pointer text-sm font-medium flex items-start gap-2 min-w-[280px]',
          toast.type === 'error'   && 'bg-red-600 text-white',
          toast.type === 'success' && 'bg-green-600 text-white',
          toast.type === 'info'    && 'bg-blue-600 text-white',
        ]"
      >
        <span class="flex-shrink-0 mt-0.5">
          <template v-if="toast.type === 'error'">&#x2716;</template>
          <template v-else-if="toast.type === 'success'">&#x2714;</template>
          <template v-else>&#x2139;</template>
        </span>
        <span>{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from '../stores/toast'

const toastStore = useToastStore()
</script>

<style scoped>
.toast-enter-active {
  transition: all 0.3s ease-out;
}
.toast-leave-active {
  transition: all 0.2s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
