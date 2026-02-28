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
  getProfile: () => api.get('/company'),
  setup: (formData: FormData) =>
    axios.post('/api/company/setup', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (data: { name?: string; website?: string; industry?: string; kad_codes?: string }) =>
    api.put('/company', data),
  rescrape: () => api.post('/company/rescrape'),
  getHelpCenter: () => api.get('/company/help-center'),
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
