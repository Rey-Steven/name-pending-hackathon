<template>
  <div>
    <PageHeader title="Emails" :subtitle="tabSubtitle" />

    <!-- Tabs -->
    <div class="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="switchTab(tab.key)"
        :class="[
          'px-4 py-2 rounded-md text-sm font-medium transition-colors',
          activeTab === tab.key ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
        ]"
      >
        {{ tab.label }}
        <span v-if="tab.count != null" class="ml-1 text-xs text-gray-400">({{ tab.count }})</span>
      </button>
    </div>

    <!-- THREADS TAB -->
    <div v-if="activeTab === 'threads'">
      <div class="flex items-center space-x-4 mb-4">
        <input
          v-model="threadSearch"
          type="text"
          placeholder="Search by company, contact, or subject..."
          class="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
        />
        <button
          @click="fetchThreads"
          :disabled="threadsLoading"
          class="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {{ threadsLoading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <div v-if="threadsLoading && !threads.length" class="text-center py-12 text-gray-400">
        Loading threads...
      </div>

      <div v-else-if="filteredThreads.length" class="space-y-3">
        <!-- Thread Card -->
        <div
          v-for="thread in filteredThreads"
          :key="thread.deal_id"
          class="bg-white rounded-lg shadow overflow-hidden"
        >
          <!-- Thread Header -->
          <div
            @click="toggleThread(thread.deal_id)"
            class="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center space-x-4">
              <div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                {{ thread.email_count }}
              </div>
              <div>
                <div class="font-medium text-gray-900">{{ thread.lead_name || 'Unknown Company' }}</div>
                <div class="text-sm text-gray-500">
                  {{ thread.contact_name }}
                  <span v-if="thread.contact_email" class="text-gray-400">&middot; {{ thread.contact_email }}</span>
                </div>
                <div class="text-xs text-gray-400 mt-0.5 truncate max-w-md">{{ thread.subject }}</div>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <StatusBadge :status="thread.deal_status || 'pending'" />
              <span class="text-xs text-gray-400 whitespace-nowrap">{{ formatDateTime(thread.last_activity) }}</span>
              <svg
                :class="['w-5 h-5 text-gray-400 transition-transform', expandedThreads.has(thread.deal_id) ? 'rotate-180' : '']"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <!-- Thread Body (expanded) -->
          <div v-if="expandedThreads.has(thread.deal_id)" class="border-t">
            <!-- Email messages -->
            <div class="px-5 py-4 space-y-3 bg-gray-50">
              <div
                v-for="email in thread.emails"
                :key="email.id"
                :class="[
                  'p-3 rounded-lg max-w-[85%]',
                  isInbound(email)
                    ? 'bg-white border border-gray-200 mr-auto'
                    : 'bg-blue-50 border border-blue-200 ml-auto'
                ]"
              >
                <div class="flex items-center justify-between mb-1">
                  <span
                    class="text-xs font-medium"
                    :class="isInbound(email) ? 'text-gray-600' : 'text-blue-600'"
                  >
                    {{ isInbound(email) ? (email.sender_email || thread.contact_email || 'Customer') : 'AgentFlow' }}
                  </span>
                  <span class="text-xs text-gray-400 ml-3">{{ formatDateTime(email.created_at) }}</span>
                </div>
                <div class="text-xs text-gray-500 mb-1">{{ email.subject }}</div>
                <div class="text-sm text-gray-700 whitespace-pre-line">{{ truncateBody(email.body) }}</div>
                <!-- Badges -->
                <div class="flex items-center space-x-2 mt-2">
                  <span
                    v-if="isInbound(email)"
                    class="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                  >
                    inbound
                  </span>
                  <span
                    v-if="email.email_type && !isInbound(email)"
                    :class="emailTypeBadge(email.email_type)"
                    class="px-2 py-0.5 rounded text-xs font-medium"
                  >
                    {{ email.email_type }}
                  </span>
                  <span
                    v-if="email.task_id"
                    class="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-600"
                  >
                    task: {{ email.task_id.substring(0, 8) }}...
                  </span>
                </div>
              </div>
            </div>

            <!-- Linked Tasks -->
            <div v-if="thread.tasks?.length" class="px-5 py-3 border-t bg-white">
              <h4 class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Linked Tasks</h4>
              <div class="space-y-1">
                <div
                  v-for="task in thread.tasks"
                  :key="task.id"
                  class="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                >
                  <div class="flex items-center space-x-2">
                    <span class="font-medium text-gray-700">{{ task.title }}</span>
                    <span class="text-xs text-gray-400">
                      <span :class="agentColor(task.source_agent)">{{ task.source_agent }}</span>
                      &rarr;
                      <span :class="agentColor(task.target_agent)">{{ task.target_agent }}</span>
                    </span>
                  </div>
                  <StatusBadge :status="task.status || 'pending'" />
                </div>
              </div>
            </div>

            <!-- View Deal link -->
            <div class="px-5 py-2 border-t bg-white text-right">
              <router-link
                :to="`/deals/${thread.deal_id}`"
                class="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View Deal &rarr;
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        No email threads found.
      </div>
    </div>

    <!-- ALL SENT TAB -->
    <div v-if="activeTab === 'sent'">
      <div class="flex items-center space-x-4 mb-4">
        <input
          v-model="sentSearch"
          type="text"
          placeholder="Search by recipient or subject..."
          class="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
        />
      </div>
      <div v-if="sentLoading" class="text-center py-12 text-gray-400">Loading sent emails...</div>
      <div v-else-if="filteredSent.length" class="bg-white rounded-lg shadow overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent At</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="email in filteredSent" :key="email.id" class="hover:bg-gray-50">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">{{ email.recipient_name }}</div>
                <div class="text-xs text-gray-400">{{ email.recipient_email }}</div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700 max-w-md truncate">{{ email.subject }}</td>
              <td class="px-4 py-3">
                <span
                  :class="emailTypeBadge(email.email_type)"
                  class="px-2 py-1 rounded text-xs font-medium"
                >
                  {{ email.email_type || '-' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="email.status || 'pending'" />
              </td>
              <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDateTime(email.sent_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        No sent emails found.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { emailsApi } from '../api/client'
import { formatDateTime } from '../utils/format'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const activeTab = ref('threads')

// Thread tab state
const threads = ref<any[]>([])
const threadsLoading = ref(true)
const threadSearch = ref('')
const expandedThreads = reactive(new Set<string>())

// Sent tab state
const sentEmails = ref<any[]>([])
const sentLoading = ref(false)
const sentSearch = ref('')
const sentLoaded = ref(false)

const tabs = computed(() => [
  { key: 'threads', label: 'Threads', count: threads.value.length || undefined },
  { key: 'sent', label: 'All Sent', count: sentEmails.value.length || undefined },
])

const tabSubtitle = computed(() => {
  if (activeTab.value === 'threads') return `${filteredThreads.value.length} conversation threads`
  return `${filteredSent.value.length} sent emails`
})

const filteredThreads = computed(() => {
  if (!threadSearch.value) return threads.value
  const q = threadSearch.value.toLowerCase()
  return threads.value.filter((t: any) =>
    t.lead_name?.toLowerCase().includes(q) ||
    t.contact_name?.toLowerCase().includes(q) ||
    t.contact_email?.toLowerCase().includes(q) ||
    t.subject?.toLowerCase().includes(q)
  )
})

const filteredSent = computed(() => {
  if (!sentSearch.value) return sentEmails.value
  const q = sentSearch.value.toLowerCase()
  return sentEmails.value.filter((e: any) =>
    e.recipient_name?.toLowerCase().includes(q) ||
    e.recipient_email?.toLowerCase().includes(q) ||
    e.subject?.toLowerCase().includes(q)
  )
})

function isInbound(email: any): boolean {
  return email.direction === 'inbound'
}

function truncateBody(body: string): string {
  if (!body) return '-'
  return body.length > 400 ? body.substring(0, 400) + '...' : body
}

function toggleThread(dealId: string) {
  if (expandedThreads.has(dealId)) {
    expandedThreads.delete(dealId)
  } else {
    expandedThreads.add(dealId)
  }
}

function emailTypeBadge(type: string): string {
  const map: Record<string, string> = {
    proposal: 'bg-blue-100 text-blue-800',
    invoice: 'bg-red-100 text-red-800',
    confirmation: 'bg-green-100 text-green-800',
    follow_up: 'bg-orange-100 text-orange-800',
  }
  return map[type] || 'bg-gray-100 text-gray-700'
}

const agentColors: Record<string, string> = {
  marketing: 'text-cyan-600',
  sales: 'text-blue-600',
  legal: 'text-purple-600',
  accounting: 'text-red-600',
  email: 'text-orange-600',
}

function agentColor(agent: string): string {
  return agentColors[agent] || 'text-gray-600'
}

async function fetchThreads() {
  threadsLoading.value = true
  try {
    const res = await emailsApi.getThreads()
    threads.value = res.data.threads || []
  } catch (e) {
    console.error('Failed to fetch threads:', e)
  } finally {
    threadsLoading.value = false
  }
}

async function fetchSent() {
  if (sentLoaded.value) return
  sentLoading.value = true
  try {
    const res = await emailsApi.getAll()
    sentEmails.value = res.data
    sentLoaded.value = true
  } catch (e) {
    console.error('Failed to fetch sent emails:', e)
  } finally {
    sentLoading.value = false
  }
}

function switchTab(tab: string) {
  activeTab.value = tab
  if (tab === 'threads') fetchThreads()
  else if (tab === 'sent') fetchSent()
}

// Load threads by default
fetchThreads()
</script>
