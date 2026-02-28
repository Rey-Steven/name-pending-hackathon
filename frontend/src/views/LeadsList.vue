<template>
  <div>
    <PageHeader title="Leads" :subtitle="`${filteredLeads.length} leads`">
      <template #actions>
        <router-link
          to="/leads/new"
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
    <div v-else-if="filteredLeads.length" class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Industry</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="lead in filteredLeads" :key="lead.id" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-900">{{ lead.company_name }}</div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { leadsApi } from '../api/client'
import { formatDate } from '../utils/format'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const leads = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')
const scoreFilter = ref('')

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
