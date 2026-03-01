<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">New Lead</h1>

    <form @submit.prevent="submitLead" class="bg-white rounded-lg shadow p-6 space-y-6">
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

      <div>
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

const form = ref({
  companyName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  productInterest: '',
  companyWebsite: '',
})

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
