<template>
  <div>
    <PageHeader title="Leads" :subtitle="`${filteredLeads.length} leads`">
      <template #actions>
        <button
          v-if="selectedIds.size > 0"
          @click="runWorkflows"
          :disabled="workflowRunning"
          class="px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ workflowRunning ? 'Running...' : `Run Workflow (${selectedIds.size})` }}
        </button>
        <router-link
          :to="`/company/${$route.params.companyId}/leads/new`"
          class="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          + New Lead
        </router-link>
      </template>
    </PageHeader>

    <!-- Filters -->
    <div class="flex items-center space-x-4 mb-6">
      <input
        v-model="search"
        type="text"
        placeholder="Search by company or contact..."
        class="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
      />
      <select
        v-model="statusFilter"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Statuses</option>
        <option value="new">New</option>
        <option value="qualified">Qualified</option>
        <option value="contacted">Contacted</option>
        <option value="converted">Converted</option>
        <option value="rejected">Rejected</option>
      </select>
      <select
        v-model="scoreFilter"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Scores</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>
    </div>

    <!-- Table -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading leads...</div>
    <div v-else-if="filteredLeads.length" class="bg-white rounded-lg shadow overflow-x-auto">
      <table class="w-full min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 w-8">
              <input
                type="checkbox"
                :checked="allFilteredSelected"
                @change="toggleSelectAll"
                class="rounded border-gray-300 text-blue-600 cursor-pointer"
              />
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Industry</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="lead in filteredLeads"
            :key="lead.id"
            class="hover:bg-gray-50"
            :class="{ 'bg-blue-50': selectedIds.has(lead.id) }"
          >
            <td class="px-4 py-3 w-8">
              <input
                type="checkbox"
                :checked="selectedIds.has(lead.id)"
                @change="toggleSelect(lead.id)"
                class="rounded border-gray-300 text-blue-600 cursor-pointer"
              />
            </td>
            <td class="px-4 py-3">
              <div class="font-medium text-gray-900 flex items-center gap-2">
                {{ lead.company_name }}
                <span v-if="workflowResults[lead.id]" :class="resultClass(lead.id)" class="text-xs font-medium px-1.5 py-0.5 rounded">
                  {{ workflowResults[lead.id] }}
                </span>
              </div>
              <div v-if="lead.company_website" class="text-xs text-gray-400">{{ lead.company_website }}</div>
            </td>
            <td class="px-4 py-3">
              <div>{{ lead.contact_name }}</div>
              <div class="text-xs text-gray-400">{{ lead.contact_email || '-' }}</div>
            </td>
            <td class="px-4 py-3 text-gray-600 text-sm">{{ lead.industry || '-' }}</td>
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
              <span v-else class="text-gray-400 text-sm">-</span>
            </td>
            <td class="px-4 py-3">
              <StatusBadge :status="lead.status || 'new'" />
            </td>
            <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDate(lead.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
      No leads match your filters.
    </div>

    <!-- Workflow progress log -->
    <div v-if="progressLog.length" class="mt-4 bg-gray-900 rounded-lg p-4 text-sm font-mono max-h-64 overflow-y-auto">
      <div
        v-for="(line, i) in progressLog"
        :key="i"
        :class="{
          'text-green-400': line.type === 'success',
          'text-red-400': line.type === 'error',
          'text-yellow-400': line.type === 'running',
          'text-gray-400': line.type === 'info',
        }"
      >
        {{ line.text }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { leadsApi, workflowApi } from '../api/client'
import { formatDate } from '../utils/format'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const leads = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')
const scoreFilter = ref('')

const selectedIds = ref<Set<string>>(new Set())
const workflowRunning = ref(false)
const workflowResults = ref<Record<string, string>>({})
const progressLog = ref<Array<{ text: string; type: 'info' | 'running' | 'success' | 'error' }>>([])

const filteredLeads = computed(() => {
  let result = leads.value
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(l =>
      l.company_name?.toLowerCase().includes(q) ||
      l.contact_name?.toLowerCase().includes(q)
    )
  }
  if (statusFilter.value) {
    result = result.filter(l => l.status === statusFilter.value)
  }
  if (scoreFilter.value) {
    result = result.filter(l => l.lead_score === scoreFilter.value)
  }
  return result
})

const allFilteredSelected = computed(() =>
  filteredLeads.value.length > 0 && filteredLeads.value.every(l => selectedIds.value.has(l.id))
)

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleSelectAll() {
  if (allFilteredSelected.value) {
    const next = new Set(selectedIds.value)
    filteredLeads.value.forEach(l => next.delete(l.id))
    selectedIds.value = next
  } else {
    const next = new Set(selectedIds.value)
    filteredLeads.value.forEach(l => next.add(l.id))
    selectedIds.value = next
  }
}

function resultClass(id: string) {
  const r = workflowResults.value[id]
  if (r === 'running') return 'bg-yellow-100 text-yellow-800'
  if (r === 'done') return 'bg-green-100 text-green-800'
  if (r === 'error') return 'bg-red-100 text-red-800'
  return ''
}

function log(text: string, type: 'info' | 'running' | 'success' | 'error' = 'info') {
  progressLog.value.push({ text, type })
}

async function runWorkflows() {
  if (workflowRunning.value) return

  const ids = [...selectedIds.value]
  workflowRunning.value = true
  workflowResults.value = {}
  progressLog.value = []

  log(`Starting workflow for ${ids.length} lead(s)...`, 'info')

  for (const id of ids) {
    const lead = leads.value.find(l => l.id === id)
    const name = lead?.company_name ?? id

    workflowResults.value = { ...workflowResults.value, [id]: 'running' }
    log(`  → ${name}`, 'running')

    try {
      await workflowApi.start(id)
      workflowResults.value = { ...workflowResults.value, [id]: 'done' }
      log(`  ✓ ${name} — workflow started`, 'success')
    } catch (err: any) {
      workflowResults.value = { ...workflowResults.value, [id]: 'error' }
      log(`  ✗ ${name} — ${err?.response?.data?.error ?? err.message}`, 'error')
    }
  }

  log(`Done.`, 'info')
  workflowRunning.value = false

  // Refresh lead statuses
  try {
    const res = await leadsApi.getAll()
    leads.value = res.data
  } catch {}
}

onMounted(async () => {
  try {
    const res = await leadsApi.getAll()
    leads.value = res.data
  } catch (e) {
    console.error('Failed to fetch leads:', e)
  } finally {
    loading.value = false
  }
})
</script>
