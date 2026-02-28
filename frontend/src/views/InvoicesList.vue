<template>
  <div>
    <PageHeader title="Invoices" :subtitle="`${filteredInvoices.length} invoices`" />

    <!-- Summary cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Total Amount</div>
        <div class="text-xl font-bold text-gray-900">{{ formatCurrency(totalAmount) }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Paid</div>
        <div class="text-xl font-bold text-green-600">{{ paidCount }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Unpaid</div>
        <div class="text-xl font-bold text-yellow-600">{{ unpaidCount }}</div>
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
        v-model="paymentFilter"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Payment Statuses</option>
        <option value="unpaid">Unpaid</option>
        <option value="paid">Paid</option>
        <option value="partial">Partial</option>
      </select>
    </div>

    <!-- Table -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading invoices...</div>
    <div v-else-if="filteredInvoices.length" class="bg-white rounded-lg shadow overflow-x-auto">
      <table class="w-full min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">FPA</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="inv in filteredInvoices" :key="inv.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 font-mono font-medium text-gray-900">{{ inv.invoice_number }}</td>
            <td class="px-4 py-3">
              <div class="font-medium text-gray-900">{{ inv.customer_name }}</div>
              <div class="text-xs text-gray-400">AFM: {{ inv.customer_afm || '-' }}</div>
            </td>
            <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDate(inv.invoice_date) }}</td>
            <td class="px-4 py-3 text-sm" :class="isOverdue(inv) ? 'text-red-600 font-medium' : 'text-gray-500'">
              {{ formatDate(inv.due_date) }}
            </td>
            <td class="px-4 py-3 text-right text-sm">{{ formatCurrency(inv.subtotal) }}</td>
            <td class="px-4 py-3 text-right text-sm text-gray-500">{{ formatCurrency(inv.fpa_amount) }}</td>
            <td class="px-4 py-3 text-right font-medium">{{ formatCurrency(inv.total_amount) }}</td>
            <td class="px-4 py-3">
              <StatusBadge :status="inv.payment_status || 'unpaid'" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
      No invoices match your filters.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { invoicesApi } from '../api/client'
import { formatCurrency, formatDate } from '../utils/format'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const invoices = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const paymentFilter = ref('')

function isOverdue(inv: any): boolean {
  if (!inv.due_date || inv.payment_status === 'paid') return false
  return new Date(inv.due_date) < new Date()
}

const filteredInvoices = computed(() => {
  let result = invoices.value
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(i =>
      i.customer_name?.toLowerCase().includes(q) ||
      i.invoice_number?.toLowerCase().includes(q)
    )
  }
  if (paymentFilter.value) {
    result = result.filter(i => i.payment_status === paymentFilter.value)
  }
  return result
})

const totalAmount = computed(() => invoices.value.reduce((sum, i) => sum + (i.total_amount || 0), 0))
const paidCount = computed(() => invoices.value.filter(i => i.payment_status === 'paid').length)
const unpaidCount = computed(() => invoices.value.filter(i => i.payment_status !== 'paid').length)

onMounted(async () => {
  try {
    const res = await invoicesApi.getAll()
    invoices.value = res.data
  } catch (e) {
    console.error('Failed to fetch invoices:', e)
  } finally {
    loading.value = false
  }
})
</script>
