<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
    :class="{
      'bg-gray-100 text-gray-600': status === 'idle' || status === 'draft' || status === 'void',
      'bg-blue-100 text-blue-800': status === 'processing' || status === 'new' || status === 'proposal_sent' || status === 'lead_contacted' || status === 'in_pipeline' || status === 'issued',
      'bg-green-100 text-green-800': status === 'completed' || status === 'closed_won' || status === 'converted' || status === 'paid' || status === 'sent' || status === 'qualified' || status === 'accepted',
      'bg-red-100 text-red-800': status === 'failed' || status === 'closed_lost' || status === 'rejected' || status === 'overdue',
      'bg-yellow-100 text-yellow-800': status === 'pending' || status === 'offer_pending_approval' || status === 'unpaid' || status === 'contacted' || status === 'partial',
      'bg-orange-100 text-orange-800': status === 'negotiating' || status === 'offer_sent' || status === 'reopened',
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
