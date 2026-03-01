<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h2 class="text-lg font-semibold mb-6">Agent Pipeline</h2>

    <div class="relative">
      <!-- Vertical connector line -->
      <div class="absolute left-5 top-6 bottom-[108px] w-px bg-gray-200"></div>

      <div class="space-y-1">

        <!-- Marketing Agent -->
        <div class="flex items-center gap-3 py-2.5">
          <div class="relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
            :class="getAgentBg('marketing')">
            🎯
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-center gap-2">
              <span class="font-medium text-sm text-marketing">Marketing Agent</span>
              <StatusBadge :status="getAgentStatus('marketing')" />
            </div>
            <p class="text-xs text-gray-400 mt-0.5">Leads, research & content</p>
          </div>
        </div>

        <!-- Sales Agent -->
        <div class="flex items-center gap-3 py-2.5">
          <div class="relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
            :class="getAgentBg('sales')">
            💼
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-center gap-2">
              <span class="font-medium text-sm text-sales">Sales Agent</span>
              <StatusBadge :status="getAgentStatus('sales')" />
            </div>
            <p class="text-xs text-gray-400 mt-0.5">Qualification & deal closure</p>
          </div>
        </div>

        <!-- Branch label -->
        <div class="flex items-center gap-3 py-1">
          <div class="w-10 shrink-0 flex justify-center">
            <div class="w-px h-4 bg-gray-200"></div>
          </div>
          <p class="text-xs text-gray-400 italic">On deal closed</p>
        </div>

        <!-- Parallel agents -->
        <div class="flex items-stretch gap-2 pt-1 ml-0">
          <!-- Left spacer to keep alignment -->
          <div class="w-10 shrink-0"></div>

          <div class="flex-1 grid grid-cols-3 gap-2">
            <!-- Legal -->
            <div class="rounded-lg border p-3" :class="getAgentBorder('legal')">
              <div class="flex items-center gap-1.5 mb-2">
                <span class="text-base">⚖️</span>
                <span class="font-medium text-xs text-legal">Legal</span>
              </div>
              <StatusBadge :status="getAgentStatus('legal')" />
              <p class="text-xs text-gray-400 mt-1.5">Compliance</p>
            </div>

            <!-- Accounting -->
            <div class="rounded-lg border p-3" :class="getAgentBorder('accounting')">
              <div class="flex items-center gap-1.5 mb-2">
                <span class="text-base">📊</span>
                <span class="font-medium text-xs text-accounting">Accounting</span>
              </div>
              <StatusBadge :status="getAgentStatus('accounting')" />
              <p class="text-xs text-gray-400 mt-1.5">Invoicing</p>
            </div>

            <!-- Email -->
            <div class="rounded-lg border p-3" :class="getAgentBorder('email')">
              <div class="flex items-center gap-1.5 mb-2">
                <span class="text-base">📧</span>
                <span class="font-medium text-xs text-email">Email</span>
              </div>
              <StatusBadge :status="getAgentStatus('email')" />
              <p class="text-xs text-gray-400 mt-1.5">Notifications</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
  if (status === 'processing') return 'border-blue-300 bg-blue-50 animate-pulse'
  if (status === 'completed') return 'border-green-300 bg-green-50'
  if (status === 'failed') return 'border-red-300 bg-red-50'
  return 'border-gray-200 bg-gray-50'
}
</script>
