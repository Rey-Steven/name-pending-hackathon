<template>
  <div>
    <h1 class="text-3xl font-bold text-gray-900 mb-8">Agent Dashboard</h1>

    <!-- Stats Cards -->
    <div class="grid grid-cols-5 gap-4 mb-8" v-if="store.stats">
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-marketing">
        <p class="text-sm text-gray-500">Leads</p>
        <p class="text-2xl font-bold">{{ store.stats.leads.total }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-sales">
        <p class="text-sm text-gray-500">Deals</p>
        <p class="text-2xl font-bold">{{ store.stats.deals.total }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-legal">
        <p class="text-sm text-gray-500">Tasks</p>
        <p class="text-2xl font-bold">{{ store.stats.tasks.total }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-accounting">
        <p class="text-sm text-gray-500">Invoices</p>
        <p class="text-2xl font-bold">{{ store.stats.invoices.total }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-email">
        <p class="text-sm text-gray-500">Emails Sent</p>
        <p class="text-2xl font-bold">{{ store.stats.emails.sent }}</p>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-8">
      <!-- Agent Pipeline (left) -->
      <div>
        <AgentPipeline />
      </div>

      <!-- Live Events Feed (right) -->
      <div class="bg-white rounded-lg shadow">
        <div class="p-4 border-b flex justify-between items-center">
          <h2 class="text-lg font-semibold">Live Agent Events</h2>
          <span
            :class="store.isWorkflowRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'"
            class="px-3 py-1 rounded-full text-xs font-medium"
          >
            {{ store.isWorkflowRunning ? 'Workflow Running' : 'Idle' }}
          </span>
        </div>
        <div class="p-4 max-h-[500px] overflow-y-auto space-y-3">
          <div
            v-for="(event, i) in store.agentEvents"
            :key="i"
            class="p-3 rounded-lg border text-sm"
            :class="getEventClass(event)"
          >
            <div class="flex justify-between items-start">
              <span class="font-medium">{{ getAgentLabel(event.agent) }}</span>
              <span class="text-xs text-gray-400">{{ formatTime(event.timestamp) }}</span>
            </div>
            <p class="mt-1">{{ event.message }}</p>
            <div v-if="event.reasoning" class="mt-2 space-y-1">
              <p
                v-for="(step, j) in event.reasoning"
                :key="j"
                class="text-xs text-gray-600 pl-2 border-l-2 border-gray-200"
              >
                {{ step }}
              </p>
            </div>
          </div>
          <p v-if="store.agentEvents.length === 0" class="text-gray-400 text-center py-8">
            No events yet. Submit a lead to start the workflow.
          </p>
        </div>
      </div>
    </div>

    <!-- Recent Leads -->
    <div class="mt-8 bg-white rounded-lg shadow">
      <div class="p-4 border-b">
        <h2 class="text-lg font-semibold">Recent Leads</h2>
      </div>
      <table class="w-full" v-if="store.leads.length">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">Company</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">Contact</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">Score</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="lead in store.leads" :key="lead.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 font-medium">{{ lead.company_name }}</td>
            <td class="px-4 py-3 text-gray-600">{{ lead.contact_name }}</td>
            <td class="px-4 py-3">
              <span
                v-if="lead.lead_score"
                :class="{
                  'bg-green-100 text-green-800': lead.lead_score === 'A',
                  'bg-yellow-100 text-yellow-800': lead.lead_score === 'B',
                  'bg-red-100 text-red-800': lead.lead_score === 'C',
                }"
                class="px-2 py-1 rounded text-xs font-medium"
              >
                {{ lead.lead_score }}
              </span>
              <span v-else class="text-gray-400">-</span>
            </td>
            <td class="px-4 py-3">
              <span class="px-2 py-1 rounded text-xs font-medium bg-gray-100">
                {{ lead.status }}
              </span>
            </td>
            <td class="px-4 py-3">
              <button
                v-if="lead.status === 'new'"
                @click="startWorkflow(lead.id)"
                :disabled="store.isWorkflowRunning"
                class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Run Agents
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="p-8 text-center text-gray-400">
        No leads yet.
        <router-link to="/leads/new" class="text-blue-600 hover:underline">Create one</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useDashboardStore } from '../stores/dashboard'
import { workflowApi } from '../api/client'
import AgentPipeline from '../components/AgentPipeline.vue'

const store = useDashboardStore()

const agentLabels: Record<string, string> = {
  marketing: '🎯 Marketing',
  sales: '💼 Sales',
  legal: '⚖️ Legal',
  accounting: '📊 Accounting',
  email: '📧 Email',
}

function getAgentLabel(agent: string) {
  return agentLabels[agent] || agent
}

function getEventClass(event: any) {
  const base: Record<string, string> = {
    marketing: 'border-marketing bg-marketing-light',
    sales: 'border-sales bg-sales-light',
    legal: 'border-legal bg-legal-light',
    accounting: 'border-accounting bg-accounting-light',
    email: 'border-email bg-email-light',
  }
  return base[event.agent] || 'border-gray-200'
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString()
}

async function startWorkflow(leadId: number) {
  store.setWorkflowRunning(leadId)
  try {
    await workflowApi.start(leadId)
  } catch (e: any) {
    console.error('Workflow error:', e)
    store.isWorkflowRunning = false
  }
}

onMounted(() => {
  store.refreshAll()
  store.connectSSE()
})

onUnmounted(() => {
  store.disconnectSSE()
})
</script>
