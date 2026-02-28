<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
    :class="{
      'bg-gray-100 text-gray-600': status === 'idle' || status === 'draft',
      'bg-blue-100 text-blue-800': status === 'processing' || status === 'new' || status === 'proposal_sent',
      'bg-green-100 text-green-800': status === 'completed' || status === 'converted' || status === 'paid' || status === 'sent' || status === 'qualified',
      'bg-red-100 text-red-800': status === 'failed' || status === 'rejected',
      'bg-yellow-100 text-yellow-800': status === 'pending' || status === 'unpaid' || status === 'contacted',
      'bg-orange-100 text-orange-800': status === 'negotiating',
      'bg-indigo-100 text-indigo-800': status === 'legal_review' || status === 'invoicing',
    }"
  >
    <span v-if="status === 'processing'" class="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-ping"></span>
    {{ status }}
  </span>
</template>

<script setup lang="ts">
defineProps<{ status: string }>()
</script>
