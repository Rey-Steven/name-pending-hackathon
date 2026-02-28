import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { companyApi } from '../api/client'

export interface AgentContexts {
  marketing: string
  sales: string
  legal: string
  accounting: string
  email: string
}

export interface CompanyProfile {
  id: string
  name: string
  website?: string
  logo_path?: string
  industry?: string
  description?: string
  business_model?: string
  target_customers?: string
  products_services?: string
  geographic_focus?: string
  agent_context_json: AgentContexts
  setup_complete: boolean
}

export const useCompanyStore = defineStore('company', () => {
  const profile = ref<CompanyProfile | null>(null)
  const setupComplete = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const logoUrl = computed(() => {
    if (!profile.value?.logo_path) return null
    return `/uploads/${profile.value.logo_path.replace('uploads/', '')}`
  })

  async function checkSetupStatus(): Promise<boolean> {
    try {
      const res = await companyApi.getSetupStatus()
      setupComplete.value = res.data.setupComplete
      return res.data.setupComplete
    } catch {
      setupComplete.value = false
      return false
    }
  }

  async function fetchProfile() {
    try {
      const res = await companyApi.getProfile()
      profile.value = res.data
      setupComplete.value = true
    } catch {
      profile.value = null
    }
  }

  async function setupCompany(formData: FormData) {
    isLoading.value = true
    error.value = null
    try {
      const res = await companyApi.setup(formData)
      profile.value = res.data
      setupComplete.value = true
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Setup failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function rescrapeProfile() {
    isLoading.value = true
    error.value = null
    try {
      const res = await companyApi.rescrape()
      profile.value = res.data
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Re-analysis failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    profile,
    setupComplete,
    isLoading,
    error,
    logoUrl,
    checkSetupStatus,
    fetchProfile,
    setupCompany,
    rescrapeProfile,
  }
})
