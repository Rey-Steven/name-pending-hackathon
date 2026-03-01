<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
        <h1 class="text-2xl font-bold">Select a Company</h1>
        <p class="text-blue-100 mt-1">Choose which company profile to work with</p>
      </div>

      <!-- Company cards -->
      <div class="p-8">
        <div v-if="loading" class="text-center py-12">
          <p class="text-gray-400">Loading companies...</p>
        </div>

        <div v-else class="space-y-3">
          <button
            v-for="company in companyStore.companies"
            :key="company.id"
            @click="selectCompany(company.id)"
            :disabled="activating"
            class="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group disabled:opacity-50"
          >
            <div class="h-12 w-12 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
              <img
                v-if="company.logo_path"
                :src="`/uploads/${company.logo_path.replace('uploads/', '')}`"
                class="h-12 w-12 object-contain"
              />
              <span v-else class="text-sm font-bold text-gray-500">
                {{ company.name.slice(0, 2).toUpperCase() }}
              </span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-900 group-hover:text-blue-700 truncate">
                {{ company.name }}
              </p>
              <p class="text-sm text-gray-400 truncate">
                {{ company.industry || company.business_model || '' }}
              </p>
            </div>
            <svg class="w-5 h-5 text-gray-300 group-hover:text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Set up new company link -->
        <div class="mt-6 pt-6 border-t border-gray-100 text-center">
          <router-link
            to="/setup?new=1"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Set up a new company
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCompanyStore } from '../stores/company'

const router = useRouter()
const companyStore = useCompanyStore()
const loading = ref(false)
const activating = ref(false)

async function selectCompany(id: string) {
  activating.value = true
  try {
    await companyStore.activateCompany(id)
    router.push(`/company/${id}/dashboard`)
  } catch {
    // Error toast shown by interceptor
  } finally {
    activating.value = false
  }
}

onMounted(async () => {
  if (companyStore.companies.length === 0) {
    loading.value = true
    await companyStore.fetchAllCompanies()
    loading.value = false
  }
  if (companyStore.companies.length === 0) {
    router.replace('/setup')
  }
})
</script>
