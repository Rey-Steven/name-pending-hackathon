import axios from 'axios'
import { useCompanyStore } from '../stores/company'
import { useToastStore } from '../stores/toast'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach the active company ID to every request so the backend
// always knows which company the frontend intended.
api.interceptors.request.use((config) => {
  try {
    const companyStore = useCompanyStore()
    if (companyStore.activeCompanyId) {
      config.headers['X-Company-Id'] = companyStore.activeCompanyId
    }
  } catch {
    // Store may not be initialized yet (e.g., during setup)
  }
  return config
})

// Auto-show toast on API errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const toast = useToastStore()
      const message = error.response?.data?.error || error.message || 'Something went wrong'
      toast.addToast(message, 'error')
    } catch {
      // Store may not be initialized yet
    }
    return Promise.reject(error)
  }
)

export const leadsApi = {
  getAll: () => api.get('/leads'),
  getById: (id: string) => api.get(`/leads/${id}`),
  lookupAfm: (vatId: string) => api.get('/leads/lookup-afm', { params: { vatId } }),
  create: (data: {
    companyName: string
    contactName: string
    contactEmail?: string
    contactPhone?: string
    vatId?: string
    gemiNumber?: string
    taxOffice?: string
    address?: string
    city?: string
    postalCode?: string
    legalForm?: string
    productInterest?: string
    companyWebsite?: string
  }) => api.post('/leads', data),
}

export const dealsApi = {
  getAll: () => api.get('/deals'),
  getById: (id: string) => api.get(`/deals/${id}`),
  downloadPDF: (id: string) => api.get(`/deals/${id}/pdf`, { responseType: 'blob' }),
  getPendingOffers: () => api.get('/deals/pending-offers'),
  approveOffer: (dealId: string, edits: { offer_product_name?: string; offer_quantity?: number; offer_unit_price?: number; reply_body?: string }) =>
    api.post(`/deals/${dealId}/approve-offer`, edits),
  rejectOffer: (dealId: string) => api.post(`/deals/${dealId}/reject-offer`),
}

export const tasksApi = {
  getAll: () => api.get('/tasks'),
  getByAgent: (agentType: string) => api.get(`/tasks/agent/${agentType}`),
}

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getAudit: () => api.get('/dashboard/audit'),
}

export const workflowApi = {
  start: (leadId: string) => api.post('/workflow/start', { leadId }),
}

export const companyApi = {
  getSetupStatus: () => api.get('/company/setup-status'),
  getProfile:     () => api.get('/company'),
  setup: (formData: FormData) =>
    axios.post('/api/company/setup', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (data: Record<string, any>) => api.put('/company', data),
  rescrape:       () => api.post('/company/rescrape'),
  getHelpCenter:  () => api.get('/company/help-center'),
  // Multi-company
  getAll:         () => api.get('/company/all'),
  activate:       (id: string) => api.post(`/company/${id}/activate`),
  deleteCompany:  (id: string) => api.delete(`/company/${id}`),
}

export const invoicesApi = {
  getAll: () => api.get('/invoices'),
  getById: (id: string) => api.get(`/invoices/${id}`),
}

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: Record<string, number>) => api.put('/settings', data),
}

export const emailsApi = {
  getAll: () => api.get('/emails'),
  getThreads: () => api.get('/emails/threads'),
  getInbox: (limit?: number) => api.get('/emails/inbox', { params: limit ? { limit } : {} }),
  getUnread: () => api.get('/emails/unread'),
  getReplies: () => api.get('/emails/replies'),
}

export const researchApi = {
  getAll: () => api.get('/research'),
  getLatest: () => api.get('/research/latest'),
  getById: (id: string) => api.get(`/research/${id}`),
  trigger: () => api.post('/research/trigger'),
}

export const contentApi = {
  getAll: () => api.get('/content'),
  getById: (id: string) => api.get(`/content/${id}`),
  trigger: (researchId?: string) => api.post('/content/trigger', { researchId }),
  updateStatus: (id: string, status: string) => api.patch(`/content/${id}/status`, { status }),
  update: (id: string, data: { post_text?: string; hashtags?: string[] }) => api.patch(`/content/${id}`, data),
  selectImage: (id: string, imageUrl: string) => api.patch(`/content/${id}/select-image`, { image_url: imageUrl }),
  regenerateImages: (id: string) => api.post(`/content/${id}/regenerate-images`),
}

export const elorusApi = {
  // Status & connection
  status: () => api.get('/elorus/status'),
  testConnection: () => api.get('/elorus/test-connection'),
  // Contacts
  listContacts: (params?: Record<string, any>) => api.get('/elorus/contacts', { params }),
  createContact: (data: Record<string, any>) => api.post('/elorus/contacts', data),
  getContact: (id: string) => api.get(`/elorus/contacts/${id}`),
  // Products
  listProducts: (params?: Record<string, any>) => api.get('/elorus/products', { params }),
  getProduct: (id: string) => api.get(`/elorus/products/${id}`),
  // Estimates (Offers)
  listEstimates: (params?: Record<string, any>) => api.get('/elorus/estimates', { params }),
  createEstimate: (data: Record<string, any>) => api.post('/elorus/estimates', data),
  getEstimate: (id: string) => api.get(`/elorus/estimates/${id}`),
  getEstimatePDF: (id: string) => api.get(`/elorus/estimates/${id}/pdf`, { responseType: 'blob' }),
  updateEstimate: (id: string, data: Record<string, any>) => api.patch(`/elorus/estimates/${id}`, data),
  // Invoices
  listInvoices: (params?: Record<string, any>) => api.get('/elorus/invoices', { params }),
  createInvoice: (data: Record<string, any>) => api.post('/elorus/invoices', data),
  getInvoice: (id: string) => api.get(`/elorus/invoices/${id}`),
  getInvoicePDF: (id: string) => api.get(`/elorus/invoices/${id}/pdf`, { responseType: 'blob' }),
  // Lookup
  listTaxes: () => api.get('/elorus/taxes'),
  listDocumentTypes: (params?: Record<string, any>) => api.get('/elorus/document-types', { params }),
}

export const gemiApi = {
  getStatus: () => api.get('/gemi/status'),
  trigger: () => api.post('/gemi/trigger'),
  stop: () => api.post('/gemi/stop'),
  getCount: () => api.get('/gemi/companies/count'),
  listCompanies: (params?: {
    limit?: number
    startAfter?: string
    search?: string
    status?: string
    legalForm?: string
    chamberName?: string
  }) => api.get('/gemi/companies', { params }),
  getCompany: (id: string) => api.get(`/gemi/companies/${id}`),
}

// SSE connection for real-time events
export function connectToEvents(onEvent: (event: any) => void): EventSource {
  const eventSource = new EventSource('/api/dashboard/events')

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onEvent(data)
    } catch (e) {
      // Ignore parse errors (heartbeats)
    }
  }

  eventSource.onerror = () => {
    console.warn('SSE connection error, will auto-reconnect')
  }

  return eventSource
}

export default api
