<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h2 class="text-lg font-semibold mb-6">Agent Pipeline</h2>

    <div class="space-y-4">
      <!-- Marketing Agent -->
      <div class="flex items-center space-x-3">
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center text-xl"
          :class="getAgentBg('marketing')"
        >
          🎯
        </div>
        <div class="flex-1">
          <div class="flex justify-between items-center">
            <span class="font-medium text-marketing">Marketing Agent</span>
            <StatusBadge :status="getAgentStatus('marketing')" />
          </div>
          <p class="text-xs text-gray-500">Lead enrichment & scoring</p>
        </div>
      </div>

      <!-- Arrow -->
      <div class="flex justify-center">
        <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </div>

      <!-- Sales Agent -->
      <div class="flex items-center space-x-3">
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center text-xl"
          :class="getAgentBg('sales')"
        >
          💼
        </div>
        <div class="flex-1">
          <div class="flex justify-between items-center">
            <span class="font-medium text-sales">Sales Agent</span>
            <StatusBadge :status="getAgentStatus('sales')" />
          </div>
          <p class="text-xs text-gray-500">Qualification & deal closure</p>
        </div>
      </div>

      <!-- Fork arrows -->
      <div class="flex justify-center space-x-12">
        <svg class="w-6 h-6 text-red-400 -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
        <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
        <svg class="w-6 h-6 text-red-400 rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </div>

      <!-- Parallel agents: Legal, Accounting, Email -->
      <div class="grid grid-cols-3 gap-3">
        <!-- Legal -->
        <div class="p-3 rounded-lg border" :class="getAgentBorder('legal')">
          <div class="flex items-center space-x-2 mb-1">
            <span class="text-lg">⚖️</span>
            <span class="font-medium text-sm text-legal">Legal</span>
          </div>
          <StatusBadge :status="getAgentStatus('legal')" />
          <p class="text-xs text-gray-500 mt-1">Compliance</p>
        </div>

        <!-- Accounting -->
        <div class="p-3 rounded-lg border" :class="getAgentBorder('accounting')">
          <div class="flex items-center space-x-2 mb-1">
            <span class="text-lg">📊</span>
            <span class="font-medium text-sm text-accounting">Accounting</span>
          </div>
          <StatusBadge :status="getAgentStatus('accounting')" />
          <p class="text-xs text-gray-500 mt-1">Invoicing</p>
        </div>

        <!-- Email -->
        <div class="p-3 rounded-lg border" :class="getAgentBorder('email')">
          <div class="flex items-center space-x-2 mb-1">
            <span class="text-lg">📧</span>
            <span class="font-medium text-sm text-email">Email</span>
          </div>
          <StatusBadge :status="getAgentStatus('email')" />
          <p class="text-xs text-gray-500 mt-1">Notifications</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDashboardStore } from '../stores/dashboard'
import StatusBadge from './StatusBadge.vue'

const store = useDashboardStore()

function getAgentStatus(agent: string): string {
  const events = store.agentEvents.filter(e => e.agent === agent)
  if (!events.length) return 'idle'
  const latest = events[0]
  if (latest.type === 'agent_started') return 'processing'
  if (latest.type === 'agent_reasoning') return 'processing'
  if (latest.type === 'agent_completed') return 'completed'
  if (latest.type === 'agent_failed') return 'failed'
  return 'idle'
}

function getAgentBg(agent: string) {
  const status = getAgentStatus(agent)
  if (status === 'processing') return 'bg-blue-100 animate-pulse'
  if (status === 'completed') return 'bg-green-100'
  if (status === 'failed') return 'bg-red-100'
  return 'bg-gray-100'
}

function getAgentBorder(agent: string) {
  const status = getAgentStatus(agent)
  if (status === 'processing') return 'border-blue-400 bg-blue-50 animate-pulse'
  if (status === 'completed') return 'border-green-400 bg-green-50'
  if (status === 'failed') return 'border-red-400 bg-red-50'
  return 'border-gray-200'
}
</script>
