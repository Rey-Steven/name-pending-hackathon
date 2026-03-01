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
  kad_codes?: string
  help_center_json?: string
  // Richer AI context fields
  pricing_model?: string
  min_deal_value?: number
  max_deal_value?: number
  key_products?: string
  unique_selling_points?: string
  communication_language?: string
  gemi_number?: string
}

export interface CompanySummary {
  id: string
  name: string
  logo_path?: string
  industry?: string
  business_model?: string
  communication_language?: string
  created_at?: string
  is_active: boolean
}

export const useCompanyStore = defineStore('company', () => {
  const profile = ref<CompanyProfile | null>(null)
  const companies = ref<CompanySummary[]>([])
  const activeCompanyId = ref<string | null>(null)
  const setupComplete = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const backendReachable = ref<boolean | null>(null) // null = not checked yet
  const setupChecked = ref(false)

  const logoUrl = computed(() => {
    if (!profile.value?.logo_path) return null
    return `/uploads/${profile.value.logo_path.replace('uploads/', '')}`
  })

  async function checkSetupStatus(): Promise<boolean> {
    try {
      const res = await companyApi.getSetupStatus()
      backendReachable.value = true
      setupComplete.value = res.data.setupComplete
      return res.data.setupComplete
    } catch (err: any) {
      if (!err.response) {
        // No response at all = backend unreachable (network error, timeout)
        backendReachable.value = false
      } else {
        // Got a response (e.g. 500) = backend is reachable but erroring
        backendReachable.value = true
      }
      setupComplete.value = false
      return false
    }
  }

  async function retryConnection(): Promise<boolean> {
    backendReachable.value = null
    setupChecked.value = false
    return checkSetupStatus()
  }

  async function fetchProfile() {
    try {
      const res = await companyApi.getProfile()
      profile.value = res.data
      activeCompanyId.value = res.data.id
      setupComplete.value = true
    } catch {
      profile.value = null
    }
  }

  async function fetchAllCompanies() {
    try {
      const res = await companyApi.getAll()
      companies.value = res.data
      const active = res.data.find((c: CompanySummary) => c.is_active)
      if (active) activeCompanyId.value = active.id
    } catch {
      companies.value = []
    }
  }

  async function activateCompany(id: string) {
    isLoading.value = true
    try {
      const res = await companyApi.activate(id)
      profile.value = res.data
      activeCompanyId.value = id
      setupComplete.value = true
      // Update is_active flags in the list
      companies.value = companies.value.map(c => ({ ...c, is_active: c.id === id }))
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteCompany(id: string) {
    await companyApi.deleteCompany(id)
    companies.value = companies.value.filter(c => c.id !== id)
    // If we deleted the active one, clear profile
    if (activeCompanyId.value === id) {
      profile.value = null
      activeCompanyId.value = null
      setupComplete.value = false
    }
  }

  async function setupCompany(formData: FormData) {
    isLoading.value = true
    error.value = null
    try {
      const res = await companyApi.setup(formData)
      profile.value = res.data
      activeCompanyId.value = res.data.id
      setupComplete.value = true
      // Refresh company list
      await fetchAllCompanies()
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
    companies,
    activeCompanyId,
    setupComplete,
    isLoading,
    error,
    backendReachable,
    setupChecked,
    logoUrl,
    checkSetupStatus,
    retryConnection,
    fetchProfile,
    fetchAllCompanies,
    activateCompany,
    deleteCompany,
    setupCompany,
    rescrapeProfile,
  }
})
