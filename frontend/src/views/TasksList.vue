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
    <div v-else-if="filteredTasks.length" class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="task in filteredTasks" :key="task.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 font-medium text-gray-900">{{ task.title }}</td>
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
