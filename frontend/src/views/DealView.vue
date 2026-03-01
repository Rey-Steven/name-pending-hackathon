<template>
  <div v-if="deal">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Deal #{{ deal.id }}</h1>
      <div class="flex items-center space-x-3">
        <!-- View Offer: navigates to Elorus offers tab if linked, otherwise downloads local PDF -->
        <button
          v-if="deal.subtotal > 0"
          @click="viewOffer"
          :disabled="downloadingPDF"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 text-sm font-medium"
        >
          <span v-if="downloadingPDF">Generating...</span>
          <span v-else>View Offer</span>
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

    <!-- Lead Profile -->
    <div v-if="leadProfile" class="bg-white rounded-lg shadow p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
        <span>🧠</span>
        <span>Lead Profile</span>
        <span class="ml-auto text-xs font-normal px-2 py-1 rounded-full"
          :class="leadProfile.company_informed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'">
          {{ leadProfile.company_informed ? 'Company introduced ✓' : 'Company not yet introduced' }}
        </span>
      </h2>
      <div class="grid grid-cols-2 gap-6 text-sm">
        <div v-if="leadProfile.company_background">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Company Background</p>
          <p class="text-gray-800">{{ leadProfile.company_background }}</p>
        </div>
        <div v-if="leadProfile.next_best_action">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Next Best Action</p>
          <p class="text-gray-800">{{ leadProfile.next_best_action }}</p>
        </div>
        <div v-if="leadProfile.stated_needs?.length">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Stated Needs</p>
          <ul class="list-disc list-inside space-y-0.5 text-gray-800">
            <li v-for="need in leadProfile.stated_needs" :key="need">{{ need }}</li>
          </ul>
        </div>
        <div v-if="leadProfile.pain_points?.length">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pain Points</p>
          <ul class="list-disc list-inside space-y-0.5 text-gray-800">
            <li v-for="point in leadProfile.pain_points" :key="point">{{ point }}</li>
          </ul>
        </div>
        <div v-if="leadProfile.scale_volume">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Scale / Volume</p>
          <p class="text-gray-800">{{ leadProfile.scale_volume }}</p>
        </div>
        <div v-if="leadProfile.timeline">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Timeline</p>
          <p class="text-gray-800">{{ leadProfile.timeline }}</p>
        </div>
        <div v-if="leadProfile.budget_signals">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Budget Signals</p>
          <p class="text-gray-800">{{ leadProfile.budget_signals }}</p>
        </div>
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { dealsApi } from '../api/client'

const route = useRoute()
const router = useRouter()
const deal = ref<any>(null)

const leadProfile = computed(() => {
  const raw = deal.value?.lead?.lead_profile
  if (!raw) return null
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw
    // Only show if at least one meaningful field is present
    const hasContent = p.company_background || p.stated_needs?.length || p.pain_points?.length ||
      p.scale_volume || p.timeline || p.budget_signals || p.next_best_action
    return hasContent ? p : null
  } catch { return null }
})
const downloadingPDF = ref(false)

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount || 0)
}

async function viewOffer() {
  if (!deal.value?.id) return
  // If the offer was issued via Elorus, navigate to the Elorus offers tab
  if (deal.value.elorus_estimate_id) {
    router.push(`/company/${route.params.companyId}/elorus-offers`)
    return
  }
  // Fallback: download local PDF
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
