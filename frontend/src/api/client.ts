import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const leadsApi = {
  getAll: () => api.get('/leads'),
  getById: (id: string) => api.get(`/leads/${id}`),
  create: (data: {
    companyName: string
    contactName: string
    contactEmail?: string
    contactPhone?: string
    productInterest?: string
    companyWebsite?: string
  }) => api.post('/leads', data),
}

export const dealsApi = {
  getAll: () => api.get('/deals'),
  getById: (id: string) => api.get(`/deals/${id}`),
  downloadPDF: (id: string) => api.get(`/deals/${id}/pdf`, { responseType: 'blob' }),
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
