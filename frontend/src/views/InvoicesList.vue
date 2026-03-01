<template>
  <div>
    <PageHeader title="Invoices" :subtitle="configured ? `${totalCount} invoices` : ''" />

    <!-- Not configured state -->
    <div v-if="!configured && !loading" class="bg-white rounded-lg shadow p-12 text-center">
      <div class="text-5xl mb-4">📄</div>
      <h3 class="text-lg font-semibold text-gray-700 mb-2">Elorus Not Configured</h3>
      <p class="text-gray-500 text-sm mb-4">To manage invoices, add your Elorus API credentials in Company Setup.</p>
      <router-link to="/setup" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        Go to Company Setup
      </router-link>
    </div>

    <template v-else>
      <!-- Summary cards -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">Total Invoiced</div>
          <div class="text-xl font-bold text-gray-900">{{ formatCurrency(summaryTotal) }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">Total Paid</div>
          <div class="text-xl font-bold text-green-600">{{ formatCurrency(summaryPaid) }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">Outstanding</div>
          <div class="text-xl font-bold text-yellow-600">{{ formatCurrency(summaryOutstanding) }}</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center space-x-4 mb-6">
        <input
          v-model="search"
          type="text"
          placeholder="Search by customer or invoice #..."
          class="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
        />
        <select
          v-model="statusFilter"
          class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </select>
      </div>

      <!-- Table -->
      <div v-if="loading" class="text-center py-12 text-gray-400">Loading invoices...</div>
      <div v-else-if="invoices.length" class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="w-full min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="inv in invoices" :key="inv.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 font-mono font-medium text-gray-900">{{ inv.representation || inv.number }}</td>
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">{{ inv.client_display_name }}</div>
                <div v-if="inv.client_vat_number" class="text-xs text-gray-400">AFM: {{ inv.client_vat_number }}</div>
              </td>
              <td class="px-4 py-3 text-gray-500 text-sm">{{ inv.date }}</td>
              <td class="px-4 py-3 text-right font-medium">{{ formatAmount(inv.total) }}</td>
              <td class="px-4 py-3 text-right text-sm" :class="inv.paid === inv.payable ? 'text-green-600' : 'text-yellow-600'">
                {{ formatAmount(inv.paid) }}
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="inv.status" />
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end space-x-2">
                  <button
                    @click="downloadPDF(inv.id, inv.representation)"
                    class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                    title="Download PDF"
                  >
                    PDF
                  </button>
                  <button
                    v-if="inv.permalink"
                    @click="viewOnElorus(inv.permalink)"
                    class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
                    title="View on Elorus"
                  >
                    Elorus
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <div class="text-sm text-gray-500">
            Showing {{ invoices.length }} of {{ totalCount }} invoices
          </div>
          <div class="flex space-x-2">
            <button
              @click="goToPage(currentPage - 1)"
              :disabled="currentPage <= 1"
              class="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Previous
            </button>
            <span class="px-3 py-1 text-sm text-gray-600">Page {{ currentPage }}</span>
            <button
              @click="goToPage(currentPage + 1)"
              :disabled="!hasNextPage"
              class="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        No invoices match your filters.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { elorusApi } from '../api/client'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const invoices = ref<any[]>([])
const loading = ref(true)
const configured = ref(true)
const search = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const totalCount = ref(0)
const hasNextPage = ref(false)

// Summary
const summaryTotal = ref(0)
const summaryPaid = ref(0)
const summaryOutstanding = computed(() => summaryTotal.value - summaryPaid.value)

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(val)
}

function formatAmount(val?: string): string {
  if (!val) return '€0.00'
  return formatCurrency(parseFloat(val))
}

function viewOnElorus(permalink: string) {
  if (permalink) {
    const url = permalink.startsWith('http') ? permalink : `https:${permalink}`
    window.open(url, '_blank')
  }
}

async function downloadPDF(id: string, name?: string) {
  try {
    const res = await elorusApi.getInvoicePDF(id)
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name || 'invoice'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Failed to download PDF:', e)
  }
}

async function fetchInvoices() {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      page_size: 50,
    }
    if (search.value) params.search = search.value
    if (statusFilter.value) params.status = statusFilter.value

    const res = await elorusApi.listInvoices(params)
    const data = res.data

    if (data.configured === false) {
      configured.value = false
      loading.value = false
      return
    }

    invoices.value = data.results || []
    totalCount.value = data.count || 0
    hasNextPage.value = !!data.next

    // Calculate summaries from current page
    let total = 0
    let paid = 0
    for (const inv of invoices.value) {
      total += parseFloat(inv.total || '0')
      paid += parseFloat(inv.paid || '0')
    }
    summaryTotal.value = total
    summaryPaid.value = paid
  } catch (e) {
    console.error('Failed to fetch invoices:', e)
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  if (page < 1) return
  currentPage.value = page
  fetchInvoices()
}

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchInvoices()
  }, 300)
})

watch(statusFilter, () => {
  currentPage.value = 1
  fetchInvoices()
})

onMounted(async () => {
  try {
    const statusRes = await elorusApi.status()
    if (!statusRes.data.configured) {
      configured.value = false
      loading.value = false
      return
    }
  } catch {
    configured.value = false
    loading.value = false
    return
  }
  fetchInvoices()
})
</script>
