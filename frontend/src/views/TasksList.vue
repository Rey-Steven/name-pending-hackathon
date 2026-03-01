<template>
  <div>
    <PageHeader title="Tasks" :subtitle="`${filteredTasks.length} tasks`" />

    <!-- Filters -->
    <div class="flex items-center space-x-4 mb-6">
      <select
        v-model="statusFilter"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>
      <select
        v-model="agentFilter"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Agents</option>
        <option value="marketing">Marketing</option>
        <option value="sales">Sales</option>
        <option value="legal">Legal</option>
        <option value="accounting">Accounting</option>
        <option value="email">Email</option>
      </select>
    </div>

    <!-- Table -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading tasks...</div>
    <div v-else-if="filteredTasks.length" class="bg-white rounded-lg shadow overflow-x-auto">
      <table class="w-full min-w-full table-fixed">
        <thead class="bg-gray-50">
          <tr>
            <th class="w-8 px-2 py-3"></th>
            <th class="w-[30%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
            <th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
            <th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
            <th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            <th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <!-- eslint-disable-next-line vue/no-v-for-template-key -->
          <template v-for="task in filteredTasks" :key="task.id">
            <!-- Summary row -->
            <tr
              class="hover:bg-gray-50 cursor-pointer"
              :class="{ 'bg-gray-50': expanded === task.id }"
              @click="toggleExpand(task.id)"
            >
              <td class="px-2 py-3 text-center">
                <svg
                  class="w-4 h-4 text-gray-400 transition-transform duration-200 inline-block"
                  :class="{ 'rotate-180': expanded === task.id }"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </td>
              <td class="px-4 py-3 font-medium text-gray-900 truncate" :title="task.title">{{ task.title }}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  {{ task.task_type }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span :class="agentColor(task.source_agent)" class="text-sm font-medium">
                  {{ agentLabel(task.source_agent) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span :class="agentColor(task.target_agent)" class="text-sm font-medium">
                  {{ agentLabel(task.target_agent) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="task.status || 'pending'" />
              </td>
              <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDateTime(task.created_at) }}</td>
              <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDateTime(task.completed_at) }}</td>
            </tr>

            <!-- Expanded log detail row -->
            <tr v-if="expanded === task.id" :key="task.id + '-logs'">
              <td colspan="8" class="px-6 py-4 bg-gray-50 border-t-0">
                <div v-if="parseLogs(task).length" class="space-y-2 max-h-72 overflow-y-auto">
                  <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Execution Logs</div>
                  <div
                    v-for="(log, i) in parseLogs(task)"
                    :key="i"
                    class="flex items-start space-x-3 text-sm"
                  >
                    <!-- Timeline dot -->
                    <div class="flex-shrink-0 mt-1.5">
                      <div class="w-2 h-2 rounded-full" :class="logDotColor(log.type)"></div>
                    </div>
                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center space-x-2">
                        <span class="font-medium text-xs" :class="logTextColor(log.type)">{{ logLabel(log.type) }}</span>
                        <span class="text-gray-400 text-xs">{{ formatLogTime(log.timestamp) }}</span>
                        <span v-if="log.agent" class="text-xs text-gray-400">[{{ log.agent }}]</span>
                      </div>
                      <p class="text-gray-700 mt-0.5">{{ log.message }}</p>
                      <ul v-if="log.reasoning?.length" class="mt-1 space-y-0.5 text-xs text-gray-500 pl-2 border-l-2 border-gray-200">
                        <li v-for="(step, j) in log.reasoning" :key="j">
                          {{ j + 1 }}. {{ step }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div v-else class="text-gray-400 text-sm py-2">
                  No execution logs recorded for this task.
                </div>

                <!-- Description / Error -->
                <div v-if="task.description || task.error_message" class="mt-3 pt-3 border-t border-gray-200 space-y-1">
                  <p v-if="task.description" class="text-sm text-gray-600">
                    <span class="font-medium text-gray-500">Description:</span> {{ task.description }}
                  </p>
                  <p v-if="task.error_message" class="text-sm text-red-600">
                    <span class="font-medium">Error:</span> {{ task.error_message }}
                  </p>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
      No tasks match your filters.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { tasksApi } from '../api/client'
import { formatDateTime } from '../utils/format'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const tasks = ref<any[]>([])
const loading = ref(true)
const statusFilter = ref('')
const agentFilter = ref('')
const expanded = ref<string | null>(null)

const agentLabels: Record<string, string> = {
  marketing: 'Marketing',
  sales: 'Sales',
  legal: 'Legal',
  accounting: 'Accounting',
  email: 'Email',
}

const agentColors: Record<string, string> = {
  marketing: 'text-cyan-600',
  sales: 'text-blue-600',
  legal: 'text-purple-600',
  accounting: 'text-red-600',
  email: 'text-orange-600',
}

function agentLabel(agent: string) {
  return agentLabels[agent] || agent
}

function agentColor(agent: string) {
  return agentColors[agent] || 'text-gray-600'
}

function toggleExpand(id: string) {
  expanded.value = expanded.value === id ? null : id
}

function parseLogs(task: any): any[] {
  if (!task.logs) return []
  try { return JSON.parse(task.logs) } catch { return [] }
}

function logLabel(type: string): string {
  const labels: Record<string, string> = {
    agent_started: 'Started',
    agent_reasoning: 'Reasoning',
    agent_completed: 'Completed',
    agent_failed: 'Failed',
    info: 'Info',
    warning: 'Warning',
  }
  return labels[type] || type
}

function logDotColor(type: string): string {
  const colors: Record<string, string> = {
    agent_started: 'bg-blue-500',
    agent_reasoning: 'bg-purple-500',
    agent_completed: 'bg-green-500',
    agent_failed: 'bg-red-500',
    info: 'bg-gray-400',
    warning: 'bg-yellow-500',
  }
  return colors[type] || 'bg-gray-400'
}

function logTextColor(type: string): string {
  const colors: Record<string, string> = {
    agent_started: 'text-blue-600',
    agent_reasoning: 'text-purple-600',
    agent_completed: 'text-green-600',
    agent_failed: 'text-red-600',
    info: 'text-gray-600',
    warning: 'text-yellow-600',
  }
  return colors[type] || 'text-gray-400'
}

function formatLogTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString()
  } catch {
    return timestamp
  }
}

const filteredTasks = computed(() => {
  let result = tasks.value
  if (statusFilter.value) {
    result = result.filter(t => t.status === statusFilter.value)
  }
  if (agentFilter.value) {
    result = result.filter(t => t.source_agent === agentFilter.value || t.target_agent === agentFilter.value)
  }
  return result
})

onMounted(async () => {
  try {
    const res = await tasksApi.getAll()
    tasks.value = res.data
  } catch (e) {
    console.error('Failed to fetch tasks:', e)
  } finally {
    loading.value = false
  }
})
</script>
