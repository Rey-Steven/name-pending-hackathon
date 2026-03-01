<template>
  <div>
    <PageHeader title="Legal Reviews" :subtitle="`${filteredReviews.length} reviews`" />

    <!-- Summary Cards -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider">Total Reviews</p>
        <p class="text-2xl font-bold text-gray-900">{{ reviews.length }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider">Approved</p>
        <p class="text-2xl font-bold text-green-600">{{ reviews.filter(r => r.approval_status === 'approved').length }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider">Rejected</p>
        <p class="text-2xl font-bold text-red-600">{{ reviews.filter(r => r.approval_status === 'rejected').length }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider">Review Required</p>
        <p class="text-2xl font-bold text-yellow-600">{{ reviews.filter(r => r.approval_status === 'review_required').length }}</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center space-x-4 mb-6">
      <select
        v-model="statusFilter"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
      >
        <option value="">All Statuses</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="review_required">Review Required</option>
        <option value="pending">Pending</option>
      </select>
      <select
        v-model="riskFilter"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
      >
        <option value="">All Risk Levels</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>

    <!-- Table -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading legal reviews...</div>
    <div v-else-if="filteredReviews.length" class="bg-white rounded-lg shadow overflow-x-auto">
      <table class="w-full min-w-full table-fixed">
        <thead class="bg-gray-50">
          <tr>
            <th class="w-8 px-2 py-3"></th>
            <th class="w-[22%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AFM</th>
            <th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GDPR</th>
            <th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
            <th class="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deal Value</th>
            <th class="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <template v-for="review in filteredReviews" :key="review.id">
            <!-- Summary row -->
            <tr
              class="hover:bg-gray-50 cursor-pointer"
              :class="{ 'bg-gray-50': expanded === review.id }"
              @click="toggleExpand(review.id)"
            >
              <td class="px-2 py-3 text-center">
                <svg
                  class="w-4 h-4 text-gray-400 transition-transform duration-200 inline-block"
                  :class="{ 'rotate-180': expanded === review.id }"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </td>
              <td class="px-4 py-3 font-medium text-gray-900 truncate" :title="review.company_name">
                {{ review.company_name || 'Unknown' }}
              </td>
              <td class="px-4 py-3">
                <span :class="review.afm_valid ? 'text-green-600' : 'text-red-600'">
                  {{ review.afm_valid ? 'Valid' : 'Invalid' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span :class="review.gdpr_compliant ? 'text-green-600' : 'text-red-600'">
                  {{ review.gdpr_compliant ? 'Compliant' : 'Non-compliant' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="px-2 py-1 rounded text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-800': review.risk_level === 'low',
                    'bg-yellow-100 text-yellow-800': review.risk_level === 'medium',
                    'bg-red-100 text-red-800': review.risk_level === 'high',
                  }"
                >
                  {{ review.risk_level }}
                </span>
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="review.approval_status || 'pending'" />
              </td>
              <td class="px-4 py-3 text-gray-700 text-sm">{{ formatCurrency(review.deal_value) }}</td>
              <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDateTime(review.created_at) }}</td>
            </tr>

            <!-- Expanded detail row -->
            <tr v-if="expanded === review.id" :key="review.id + '-detail'">
              <td colspan="8" class="px-6 py-4 bg-gray-50 border-t-0">
                <div class="grid grid-cols-2 gap-6 text-sm">
                  <div class="space-y-3">
                    <div>
                      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Compliance Checks</p>
                      <div class="space-y-1">
                        <p>AFM Valid: {{ review.afm_valid ? 'Yes' : 'No' }} {{ review.afm_number ? `(${review.afm_number})` : '' }}</p>
                        <p>Company Registry (GEMI): {{ review.company_registry_valid ? 'Valid' : 'Not verified' }}</p>
                        <p>GDPR Compliant: {{ review.gdpr_compliant ? 'Yes' : 'No' }}</p>
                        <p>Contract Terms Valid: {{ review.contract_terms_valid ? 'Yes' : 'No' }}</p>
                      </div>
                    </div>
                    <div v-if="parseRiskFlags(review).length">
                      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Risk Flags</p>
                      <ul class="list-disc list-inside space-y-0.5 text-red-600">
                        <li v-for="flag in parseRiskFlags(review)" :key="flag">{{ flag }}</li>
                      </ul>
                    </div>
                  </div>
                  <div class="space-y-3">
                    <div v-if="review.approval_notes">
                      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                      <p class="text-gray-700">{{ review.approval_notes }}</p>
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Deal Info</p>
                      <p>Product: {{ review.product_name || 'N/A' }}</p>
                      <p>Deal Status: {{ review.deal_status || 'N/A' }}</p>
                    </div>
                    <div class="pt-2">
                      <router-link
                        v-if="review.deal_id"
                        :to="`/company/${$route.params.companyId}/deals/${review.deal_id}`"
                        class="text-purple-600 hover:text-purple-800 text-sm font-medium"
                      >
                        View Deal Details &rarr;
                      </router-link>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
      No legal reviews match your filters.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { legalApi } from '../api/client'
import { formatDateTime, formatCurrency } from '../utils/format'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const route = useRoute()
const reviews = ref<any[]>([])
const loading = ref(true)
const statusFilter = ref('')
const riskFilter = ref('')
const expanded = ref<string | null>(null)

function toggleExpand(id: string) {
  expanded.value = expanded.value === id ? null : id
}

function parseRiskFlags(review: any): string[] {
  if (!review.risk_flags) return []
  try {
    const parsed = typeof review.risk_flags === 'string' ? JSON.parse(review.risk_flags) : review.risk_flags
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

const filteredReviews = computed(() => {
  let result = reviews.value
  if (statusFilter.value) {
    result = result.filter(r => r.approval_status === statusFilter.value)
  }
  if (riskFilter.value) {
    result = result.filter(r => r.risk_level === riskFilter.value)
  }
  return result
})

onMounted(async () => {
  try {
    const res = await legalApi.getReviews()
    reviews.value = res.data
  } catch (e) {
    console.error('Failed to fetch legal reviews:', e)
  } finally {
    loading.value = false
  }
})
</script>
