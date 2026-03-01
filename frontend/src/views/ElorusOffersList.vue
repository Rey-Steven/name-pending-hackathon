<template>
  <div>
    <PageHeader title="Offers" :subtitle="`${totalOffers} offers`" />

    <!-- Not configured state -->
    <div v-if="!loading && !configured" class="bg-white rounded-lg shadow p-12 text-center">
      <div class="text-5xl mb-4">📄</div>
      <h3 class="text-lg font-semibold text-gray-700 mb-2">Elorus Not Configured</h3>
      <p class="text-gray-500 text-sm mb-4">To create and manage offers, add your Elorus API credentials in Company Setup.</p>
      <router-link to="/setup" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Go to Company Setup</router-link>
    </div>

    <template v-else-if="configured">
      <!-- Summary cards -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">Total Offers</div>
          <div class="text-xl font-bold text-gray-900">{{ totalOffers }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">Accepted</div>
          <div class="text-xl font-bold text-green-600">{{ acceptedCount }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">Pending</div>
          <div class="text-xl font-bold text-blue-600">{{ pendingCount }}</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center space-x-4 mb-6">
        <input
          v-model="search"
          type="text"
          placeholder="Search by client or offer #..."
          class="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
        />
        <select
          v-model="statusFilter"
          class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <!-- Table -->
      <div v-if="loading" class="text-center py-12 text-gray-400">Loading offers...</div>
      <div v-else-if="estimates.length" class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="w-full min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="est in estimates" :key="est.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 font-mono font-medium text-gray-900">{{ est.representation }}</td>
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">{{ est.client_display_name || '-' }}</div>
              </td>
              <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDate(est.date) }}</td>
              <td class="px-4 py-3 text-right text-sm">{{ formatCurrency(Number(est.net)) }}</td>
              <td class="px-4 py-3 text-right font-medium">{{ formatCurrency(Number(est.total)) }}</td>
              <td class="px-4 py-3">
                <StatusBadge :status="est.status || 'draft'" />
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center space-x-2">
                  <button
                    @click="downloadPDF(est)"
                    :disabled="downloadingId === est.id"
                    class="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 disabled:opacity-50"
                  >
                    {{ downloadingId === est.id ? 'Downloading...' : 'Download PDF' }}
                  </button>
                  <button
                    v-if="est.permalink"
                    @click="openPermalink(est)"
                    class="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100"
                  >
                    View on Elorus
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        No offers match your filters.
      </div>

      <!-- Pagination -->
      <div v-if="estimates.length" class="flex items-center justify-between mt-4">
        <button
          @click="prevPage"
          :disabled="page <= 1"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="text-sm text-gray-500">Page {{ page }}</span>
        <button
          @click="nextPage"
          :disabled="!hasNextPage"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { elorusApi } from '../api/client'
import { formatCurrency, formatDate } from '../utils/format'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const configured = ref(true)
const loading = ref(true)
const estimates = ref<any[]>([])
const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const hasNextPage = ref(false)
const downloadingId = ref<string | null>(null)

// Debounce timer
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const totalOffers = computed(() => estimates.value.length)
const acceptedCount = computed(() => estimates.value.filter(e => e.status === 'accepted').length)
const pendingCount = computed(() => estimates.value.filter(e => e.status === 'issued').length)

async function checkStatus() {
  try {
    const res = await elorusApi.status()
    configured.value = res.data.configured
  } catch {
    configured.value = false
  }
}

async function fetchEstimates() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value }
    if (statusFilter.value) params.status = statusFilter.value
    if (search.value) params.search = search.value
    const res = await elorusApi.listEstimates(params)
    const data = res.data
    // Elorus API may return { results: [...], next: ... } or an array directly
    if (Array.isArray(data)) {
      estimates.value = data
      hasNextPage.value = false
    } else {
      estimates.value = data.results || []
      hasNextPage.value = !!data.next
    }
  } catch (e) {
    console.error('Failed to fetch estimates:', e)
    estimates.value = []
  } finally {
    loading.value = false
  }
}

async function downloadPDF(estimate: any) {
  downloadingId.value = estimate.id
  try {
    const res = await elorusApi.getEstimatePDF(estimate.id)
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${estimate.representation || 'offer'}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Failed to download PDF:', e)
  } finally {
    downloadingId.value = null
  }
}

function openPermalink(estimate: any) {
  if (estimate.permalink) {
    window.open(estimate.permalink, '_blank')
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value--
  }
}

function nextPage() {
  if (hasNextPage.value) {
    page.value++
  }
}

// Watch status filter — reset page and fetch immediately
watch(statusFilter, () => {
  page.value = 1
  fetchEstimates()
})

// Watch search with debounce
watch(search, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    fetchEstimates()
  }, 300)
})

// Watch page changes
watch(page, () => {
  fetchEstimates()
})

onMounted(async () => {
  await checkStatus()
  if (configured.value) {
    await fetchEstimates()
  } else {
    loading.value = false
  }
})
</script>
