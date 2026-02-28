<template>
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">{{ title }}</h1>
      <p v-if="subtitle" class="text-gray-500 mt-1">{{ subtitle }}</p>
    </div>
    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>
