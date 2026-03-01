<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">New Lead</h1>

    <form @submit.prevent="submitLead" class="bg-white rounded-lg shadow p-6 space-y-6">

      <!-- Contact Info -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
        <input
          v-model="form.companyName"
          type="text"
          required
          class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., Κατασκευές Αθηνών ΑΕ"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Contact Name *</label>
        <input
          v-model="form.contactName"
          type="text"
          required
          class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., Παναγιώτης Δημητρίου"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            v-model="form.contactEmail"
            type="email"
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="p.dimitriou@company.gr"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            v-model="form.contactPhone"
            type="tel"
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="+30 210 1234567"
          />
        </div>
      </div>

      <!-- Greek Business Fields -->
      <div class="border-t pt-4">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Greek Business Info
          <span v-if="afmLookupState === 'loading'" class="ml-2 text-blue-500 font-normal normal-case">Looking up ΓΕΜΗ…</span>
          <span v-else-if="afmLookupState === 'ok'" class="ml-2 text-green-600 font-normal normal-case">✓ Autofilled from ΓΕΜΗ</span>
          <span v-else-if="afmLookupState === 'error'" class="ml-2 text-red-500 font-normal normal-case">Could not find business</span>
        </p>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ΑΦΜ (VAT ID)</label>
            <input
              v-model="form.vatId"
              type="text"
              @blur="lookupAfm"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 123456789"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ΓΕΜΗ (GEMI Number)</label>
            <input
              v-model="form.gemiNumber"
              type="text"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 000000000000"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ΔΟΥ (Tax Office)</label>
            <input
              v-model="form.taxOffice"
              type="text"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., ΔΟΥ Αθηνών"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Legal Form</label>
            <select
              v-model="form.legalForm"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">— Select —</option>
              <option value="ΑΕ">ΑΕ (Ανώνυμη Εταιρεία)</option>
              <option value="ΕΠΕ">ΕΠΕ (Εταιρεία Περιορισμένης Ευθύνης)</option>
              <option value="ΙΚΕ">ΙΚΕ (Ιδιωτική Κεφαλαιουχική Εταιρεία)</option>
              <option value="ΟΕ">ΟΕ (Ομόρρυθμη Εταιρεία)</option>
              <option value="ΕΕ">ΕΕ (Ετερόρρυθμη Εταιρεία)</option>
              <option value="ΑΤΟΜΙΚΗ">Ατομική Επιχείρηση</option>
            </select>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            v-model="form.address"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Λεωφόρος Αθηνών 45"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              v-model="form.city"
              type="text"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Αθήνα"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Postal Code (ΤΚ)</label>
            <input
              v-model="form.postalCode"
              type="text"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 10437"
            />
          </div>
        </div>
      </div>

      <!-- Sales Info -->
      <div class="border-t pt-4">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Sales Info</p>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Product/Service Interest</label>
          <input
            v-model="form.productInterest"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Wholesale building materials"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Company Website</label>
          <input
            v-model="form.companyWebsite"
            type="url"
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://example.gr"
          />
        </div>
      </div>

      <div class="flex items-center space-x-4 pt-4">
        <button
          type="submit"
          :disabled="submitting || !form.companyName || !form.contactName"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
        >
          <span v-if="submitting">Creating...</span>
          <span v-else>Create Lead & Run Agents</span>
        </button>
        <router-link :to="`/company/${$route.params.companyId}/dashboard`" class="text-gray-500 hover:text-gray-700">
          Cancel
        </router-link>
      </div>

      <p v-if="error" class="text-red-600 text-sm mt-2">{{ error }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { leadsApi, workflowApi } from '../api/client'
import { useDashboardStore } from '../stores/dashboard'

const router = useRouter()
const route = useRoute()
const store = useDashboardStore()

const submitting = ref(false)
const error = ref('')
const afmLookupState = ref<'idle' | 'loading' | 'ok' | 'error'>('idle')

const form = ref({
  companyName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  vatId: '',
  gemiNumber: '',
  taxOffice: '',
  address: '',
  city: '',
  postalCode: '',
  legalForm: '',
  productInterest: '',
  companyWebsite: '',
})

// Field name variants returned by the GEMI API
function pick(obj: any, ...keys: string[]): string {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return String(obj[k])
  }
  return ''
}

async function lookupAfm() {
  const vatId = form.value.vatId.trim()
  if (!vatId) return

  afmLookupState.value = 'loading'
  try {
    const res = await fetch('https://publicity.businessportal.gr/api/autocomplete/butler%20chat', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,el;q=0.8',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      body: JSON.stringify({ token: vatId, language: 'el' }),
    })
    const data = await res.json()

    // The API may return a single object or an array — normalise to one record
    const record = Array.isArray(data) ? data[0] : data

    if (!record || record.message) {
      afmLookupState.value = 'error'
      return
    }

    // Map known field name variants to our form fields
    const companyName = pick(record, 'eponymia', 'company_name', 'companyName', 'name', 'title', 'onomasia')
    const gemiNumber  = pick(record, 'arithmosGemi', 'gemi', 'gemi_number', 'arithmos_gemi', 'GEMI', 'ArithmosGEMI')
    const taxOffice   = pick(record, 'doy', 'DOY', 'tax_office', 'eforia', 'Eforia', 'doyDesc', 'DOYDesc')
    const address     = pick(record, 'address', 'direction', 'odhos', 'Address', 'postal_address', 'postalAddress')
    const city        = pick(record, 'city', 'polis', 'City', 'Polis', 'municipalityDesc', 'dimos')
    const postalCode  = pick(record, 'tk', 'TK', 'postal_code', 'postalCode', 'zip', 'ZIP')
    const legalForm   = pick(record, 'legalForm', 'legal_form', 'morfi', 'eidos', 'Morfi', 'Eidos', 'companyType', 'company_type')
    const website     = pick(record, 'website', 'url', 'site', 'webPage', 'web_page')

    if (companyName) form.value.companyName   = companyName
    if (gemiNumber)  form.value.gemiNumber     = gemiNumber
    if (taxOffice)   form.value.taxOffice      = taxOffice
    if (address)     form.value.address        = address
    if (city)        form.value.city           = city
    if (postalCode)  form.value.postalCode     = postalCode
    if (legalForm)   form.value.legalForm      = legalForm
    if (website)     form.value.companyWebsite = website

    afmLookupState.value = 'ok'
  } catch {
    afmLookupState.value = 'error'
  }
}

async function submitLead() {
  submitting.value = true
  error.value = ''

  try {
    // 1. Create lead
    const res = await leadsApi.create(form.value)
    const leadId = res.data.id

    // 2. Navigate to dashboard
    router.push(`/company/${route.params.companyId}/dashboard`)

    // 3. Start workflow (agents process the lead)
    store.setWorkflowRunning(leadId)
    await workflowApi.start(leadId)
  } catch (e: any) {
    error.value = e.response?.data?.error || e.message
    store.isWorkflowRunning = false
  } finally {
    submitting.value = false
  }
}
</script>
