<template>
  <div>
    <PageHeader title="Contracts" :subtitle="`${contracts.length} contracts`" />

    <!-- Summary Cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider">Total Contracts</p>
        <p class="text-2xl font-bold text-gray-900">{{ contracts.length }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider">Total Value</p>
        <p class="text-2xl font-bold text-green-600">{{ formatCurrency(totalValue) }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider">Low Risk</p>
        <p class="text-2xl font-bold text-purple-600">{{ contracts.filter(c => c.risk_level === 'low').length }}</p>
      </div>
    </div>

    <!-- Search -->
    <div class="flex items-center space-x-4 mb-6">
      <input
        v-model="search"
        type="text"
        placeholder="Search by company or product..."
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 w-64"
      />
    </div>

    <!-- Table -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading contracts...</div>
    <div v-else-if="filteredContracts.length" class="bg-white rounded-lg shadow overflow-x-auto">
      <table class="w-full min-w-full table-fixed">
        <thead class="bg-gray-50">
          <tr>
            <th class="w-[25%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th class="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
            <th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
            <th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk</th>
            <th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deal Status</th>
            <th class="w-[13%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="contract in filteredContracts"
            :key="contract.id"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-3">
              <div>
                <p class="font-medium text-gray-900 truncate">{{ contract.company_name || 'Unknown' }}</p>
                <p class="text-xs text-gray-500">{{ contract.contact_name }}</p>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 truncate">{{ contract.product_name || 'N/A' }}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ formatCurrency(contract.deal_value) }}</td>
            <td class="px-4 py-3">
              <span
                class="px-2 py-1 rounded text-xs font-medium"
                :class="{
                  'bg-green-100 text-green-800': contract.risk_level === 'low',
                  'bg-yellow-100 text-yellow-800': contract.risk_level === 'medium',
                  'bg-red-100 text-red-800': contract.risk_level === 'high',
                }"
              >
                {{ contract.risk_level }}
              </span>
            </td>
            <td class="px-4 py-3">
              <StatusBadge :status="contract.deal_status || 'approved'" />
            </td>
            <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDate(contract.created_at) }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center space-x-2">
                <button
                  @click.stop="downloadPDF(contract)"
                  :disabled="downloading === contract.deal_id"
                  class="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50"
                >
                  {{ downloading === contract.deal_id ? '...' : 'PDF' }}
                </button>
                <router-link
                  :to="`/company/${$route.params.companyId}/deals/${contract.deal_id}`"
                  class="text-purple-600 hover:text-purple-800 text-xs font-medium"
                >
                  View
                </router-link>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
      No contracts found.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { legalApi } from '../api/client'
import { formatDate, formatCurrency } from '../utils/format'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const route = useRoute()
const contracts = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const downloading = ref<string | null>(null)

const totalValue = computed(() =>
  contracts.value.reduce((sum, c) => sum + (c.deal_value || 0), 0)
)

const filteredContracts = computed(() => {
  if (!search.value) return contracts.value
  const q = search.value.toLowerCase()
  return contracts.value.filter(c =>
    (c.company_name || '').toLowerCase().includes(q) ||
    (c.product_name || '').toLowerCase().includes(q)
  )
})

async function downloadPDF(contract: any) {
  if (!contract.deal_id) return
  downloading.value = contract.deal_id
  try {
    const response = await legalApi.downloadContractPDF(contract.deal_id)
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    const refId = contract.deal_id.slice(0, 8).toUpperCase()
    link.download = `Contract-${refId}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Contract PDF download failed:', err)
  } finally {
    downloading.value = null
  }
}

onMounted(async () => {
  try {
    const res = await legalApi.getContracts()
    contracts.value = res.data
  } catch (e) {
    console.error('Failed to fetch contracts:', e)
  } finally {
    loading.value = false
  }
})
</script>
