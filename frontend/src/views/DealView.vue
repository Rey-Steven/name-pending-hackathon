<template>
  <div v-if="deal">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Deal #{{ deal.id }}</h1>
      <div class="flex items-center space-x-3">
        <button
          v-if="deal.subtotal > 0"
          @click="downloadPDF"
          :disabled="downloadingPDF"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 text-sm font-medium"
        >
          <span v-if="downloadingPDF">Generating...</span>
          <span v-else>Download Offer PDF</span>
        </button>
        <router-link :to="`/company/${$route.params.companyId}/dashboard`" class="text-gray-500 hover:text-gray-700">Back to Dashboard</router-link>
      </div>
    </div>

    <!-- Deal Summary -->
    <div class="grid grid-cols-3 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-sm text-gray-500 mb-2">Deal Value</h3>
        <p class="text-3xl font-bold text-green-600">{{ formatCurrency(deal.total_amount) }}</p>
        <p class="text-sm text-gray-500 mt-1">
          {{ formatCurrency(deal.subtotal) }} + {{ formatCurrency(deal.fpa_amount) }} FPA
        </p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-sm text-gray-500 mb-2">Status</h3>
        <span class="px-3 py-1 rounded-full text-sm font-medium"
          :class="{
            'bg-green-100 text-green-800': deal.status === 'completed',
            'bg-yellow-100 text-yellow-800': deal.status === 'pending',
            'bg-blue-100 text-blue-800': deal.status === 'legal_review' || deal.status === 'invoicing',
            'bg-red-100 text-red-800': deal.status === 'failed',
          }"
        >
          {{ deal.status }}
        </span>
      </div>
      <div class="bg-white rounded-lg shadow p-6" v-if="deal.lead">
        <h3 class="text-sm text-gray-500 mb-2">Customer</h3>
        <p class="font-medium">{{ deal.lead.company_name }}</p>
        <p class="text-sm text-gray-600">{{ deal.lead.contact_name }}</p>
      </div>
    </div>

    <!-- Invoice -->
    <div v-if="deal.invoice" class="bg-white rounded-lg shadow p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4 flex items-center space-x-2">
        <span class="text-accounting">📊</span>
        <span>Invoice {{ deal.invoice.invoice_number }}</span>
      </h2>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p><strong>Customer:</strong> {{ deal.invoice.customer_name }}</p>
          <p><strong>AFM:</strong> {{ deal.invoice.customer_afm }}</p>
          <p v-if="deal.invoice.customer_doy"><strong>DOY:</strong> {{ deal.invoice.customer_doy }}</p>
        </div>
        <div>
          <p><strong>Date:</strong> {{ deal.invoice.invoice_date }}</p>
          <p><strong>Due:</strong> {{ deal.invoice.due_date }}</p>
          <p><strong>Payment Terms:</strong> {{ deal.invoice.payment_terms }}</p>
        </div>
      </div>
      <div class="mt-4 border-t pt-4">
        <p class="text-right"><strong>Subtotal:</strong> {{ formatCurrency(deal.invoice.subtotal) }}</p>
        <p class="text-right"><strong>FPA (24%):</strong> {{ formatCurrency(deal.invoice.fpa_amount) }}</p>
        <p class="text-right text-xl font-bold"><strong>Total:</strong> {{ formatCurrency(deal.invoice.total_amount) }}</p>
      </div>
    </div>

    <!-- Legal Validation -->
    <div v-if="deal.legalValidation" class="bg-white rounded-lg shadow p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4 flex items-center space-x-2">
        <span class="text-legal">⚖️</span>
        <span>Legal Review</span>
      </h2>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <p>AFM Valid: {{ deal.legalValidation.afm_valid ? '✅' : '❌' }}</p>
        <p>GDPR Compliant: {{ deal.legalValidation.gdpr_compliant ? '✅' : '❌' }}</p>
        <p>Contract Terms: {{ deal.legalValidation.contract_terms_valid ? '✅' : '❌' }}</p>
        <p>Risk Level: {{ deal.legalValidation.risk_level }}</p>
      </div>
      <p class="mt-2">
        <strong>Status:</strong>
        <span :class="deal.legalValidation.approval_status === 'approved' ? 'text-green-600' : 'text-red-600'" class="font-medium">
          {{ deal.legalValidation.approval_status }}
        </span>
      </p>
    </div>

    <!-- Tasks -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold mb-4">Agent Tasks</h2>
      <div class="space-y-2">
        <div v-for="task in deal.tasks" :key="task.id" class="p-3 border rounded-lg flex justify-between items-center">
          <div>
            <span class="font-medium">{{ task.title }}</span>
            <p class="text-xs text-gray-500">{{ task.source_agent }} → {{ task.target_agent }}</p>
          </div>
          <span
            :class="{
              'bg-yellow-100 text-yellow-800': task.status === 'pending',
              'bg-blue-100 text-blue-800': task.status === 'processing',
              'bg-green-100 text-green-800': task.status === 'completed',
              'bg-red-100 text-red-800': task.status === 'failed',
            }"
            class="px-2 py-1 rounded text-xs font-medium"
          >
            {{ task.status }}
          </span>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="text-center py-8 text-gray-400">Loading deal...</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { dealsApi } from '../api/client'

const route = useRoute()
const deal = ref<any>(null)
const downloadingPDF = ref(false)

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount || 0)
}

async function downloadPDF() {
  if (!deal.value?.id) return
  downloadingPDF.value = true
  try {
    const response = await dealsApi.downloadPDF(deal.value.id)
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    const refId = deal.value.id.slice(0, 8).toUpperCase()
    link.download = `Prosfora-${refId}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('PDF download failed:', err)
    // Axios interceptor shows the error toast
  } finally {
    downloadingPDF.value = false
  }
}

onMounted(async () => {
  const id = route.params.id as string
  const res = await dealsApi.getById(id)
  deal.value = res.data
})
</script>
