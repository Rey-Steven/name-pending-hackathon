import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dashboardApi, leadsApi, dealsApi, tasksApi, connectToEvents } from '../api/client'

export interface AgentEvent {
  type: string
  agent: string
  message: string
  reasoning?: string[]
  data?: Record<string, any>
  taskId?: number
  dealId?: number
  leadId?: number
  timestamp: string
}

export const useDashboardStore = defineStore('dashboard', () => {
  // State
  const stats = ref<any>(null)
  const leads = ref<any[]>([])
  const deals = ref<any[]>([])
  const tasks = ref<any[]>([])
  const auditLog = ref<any[]>([])
  const agentEvents = ref<AgentEvent[]>([])
  const activeWorkflow = ref<number | null>(null)
  const isWorkflowRunning = ref(false)
  const eventSource = ref<EventSource | null>(null)

  // Computed
  const activeAgents = computed(() => {
    const processing = tasks.value.filter(t => t.status === 'processing')
    return [...new Set(processing.map(t => t.target_agent))]
  })

  // Actions
  async function fetchStats() {
    const res = await dashboardApi.getStats()
    stats.value = res.data
  }

  async function fetchLeads() {
    const res = await leadsApi.getAll()
    leads.value = res.data
  }

  async function fetchDeals() {
    const res = await dealsApi.getAll()
    deals.value = res.data
  }

  async function fetchTasks() {
    const res = await tasksApi.getAll()
    tasks.value = res.data
  }

  async function fetchAudit() {
    const res = await dashboardApi.getAudit()
    auditLog.value = res.data
  }

  async function refreshAll() {
    await Promise.all([fetchStats(), fetchLeads(), fetchDeals(), fetchTasks(), fetchAudit()])
  }

  function connectSSE() {
    if (eventSource.value) return

    eventSource.value = connectToEvents((event: AgentEvent) => {
      agentEvents.value.unshift(event)

      // Keep only last 100 events
      if (agentEvents.value.length > 100) {
        agentEvents.value = agentEvents.value.slice(0, 100)
      }

      // Refresh data on relevant events
      if (event.type === 'agent_completed' || event.type === 'workflow_completed') {
        refreshAll()
      }

      if (event.type === 'workflow_completed') {
        isWorkflowRunning.value = false
      }
    })
  }

  function disconnectSSE() {
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
    }
  }

  function setWorkflowRunning(leadId: number) {
    activeWorkflow.value = leadId
    isWorkflowRunning.value = true
    agentEvents.value = [] // Clear previous events
  }

  return {
    stats,
    leads,
    deals,
    tasks,
    auditLog,
    agentEvents,
    activeWorkflow,
    isWorkflowRunning,
    activeAgents,
    fetchStats,
    fetchLeads,
    fetchDeals,
    fetchTasks,
    fetchAudit,
    refreshAll,
    connectSSE,
    disconnectSSE,
    setWorkflowRunning,
  }
})
