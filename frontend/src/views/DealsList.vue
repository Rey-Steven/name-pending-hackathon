<template>
  <div>
    <PageHeader title="Deals" :subtitle="`${filteredDeals.length} deals`" />

    <!-- Summary cards -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Total Value</div>
        <div class="text-xl font-bold text-gray-900">{{ formatCurrency(totalValue) }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Active</div>
        <div class="text-xl font-bold text-blue-600">{{ activeCount }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Completed</div>
        <div class="text-xl font-bold text-green-600">{{ completedCount }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Failed</div>
        <div class="text-xl font-bold text-red-600">{{ failedCount }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center space-x-4 mb-6">
      <input
        v-model="search"
        type="text"
        placeholder="Search by company or product..."
        class="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
      />
      <select
        v-model="statusFilter"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Statuses</option>
        <option value="lead_contacted">Lead Contacted</option>
        <option value="in_pipeline">In Pipeline</option>
        <option value="offer_sent">Offer Sent</option>
        <option value="offer_pending_approval">Offer Pending Approval</option>
        <option value="closed_won">Closed Won</option>
        <option value="closed_lost">Closed Lost</option>
        <option value="reopened">Reopened</option>
        <!-- legacy -->
        <option value="proposal_sent">Proposal Sent (legacy)</option>
        <option value="completed">Completed (legacy)</option>
        <option value="failed">Failed (legacy)</option>
      </select>
    </div>

    <!-- Table -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading deals...</div>
    <div v-else-if="filteredDeals.length" class="bg-white rounded-lg shadow overflow-x-auto">
      <table class="w-full min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="deal in filteredDeals" :key="deal.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 font-medium text-gray-900">{{ leadMap[deal.lead_id]?.company_name || '-' }}</td>
            <td class="px-4 py-3 text-sm text-gray-700">{{ deal.product_name || '-' }}</td>
            <td class="px-4 py-3 text-right font-medium">{{ formatCurrency(deal.total_amount) }}</td>
            <td class="px-4 py-3">
              <StatusBadge :status="deal.status || 'pending'" />
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ deal.negotiation_round || 0 }}</td>
            <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDate(deal.created_at) }}</td>
            <td class="px-4 py-3">
              <router-link
                :to="`/company/${$route.params.companyId}/deals/${deal.id}`"
                class="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
      No deals match your filters.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { dealsApi, leadsApi } from '../api/client'
import { formatCurrency, formatDate } from '../utils/format'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const deals = ref<any[]>([])
const leadMap = ref<Record<string, any>>({})
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')

const filteredDeals = computed(() => {
  let result = deals.value
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(d =>
      d.product_name?.toLowerCase().includes(q) ||
      leadMap.value[d.lead_id]?.company_name?.toLowerCase().includes(q)
    )
  }
  if (statusFilter.value) {
    result = result.filter(d => d.status === statusFilter.value)
  }
  return result
})

const totalValue = computed(() => deals.value.reduce((sum, d) => sum + (d.total_amount || 0), 0))
const activeCount = computed(() => deals.value.filter(d => ['lead_contacted', 'in_pipeline', 'offer_sent', 'offer_pending_approval', 'proposal_sent', 'negotiating', 'legal_review', 'invoicing'].includes(d.status)).length)
const completedCount = computed(() => deals.value.filter(d => ['closed_won', 'completed'].includes(d.status)).length)
const failedCount = computed(() => deals.value.filter(d => ['closed_lost', 'failed'].includes(d.status)).length)

onMounted(async () => {
  try {
    const [dealsRes, leadsRes] = await Promise.all([dealsApi.getAll(), leadsApi.getAll()])
    deals.value = dealsRes.data
    const map: Record<string, any> = {}
    for (const lead of leadsRes.data) {
      map[lead.id] = lead
    }
    leadMap.value = map
  } catch (e) {
    console.error('Failed to fetch deals:', e)
  } finally {
    loading.value = false
  }
})
</script>
