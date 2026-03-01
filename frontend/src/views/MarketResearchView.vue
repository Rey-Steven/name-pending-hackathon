<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Market Research</h1>
        <p class="text-sm text-gray-500 mt-1">AI-powered market intelligence and competitor analysis</p>
      </div>
      <button
        @click="triggerResearch"
        :disabled="isRunning"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
      >
        {{ isRunning ? 'Running...' : 'Run Research Now' }}
      </button>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Total Reports</div>
        <div class="text-xl font-bold text-gray-900">{{ research.length }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Completed</div>
        <div class="text-xl font-bold text-green-600">{{ research.filter(r => r.status === 'completed').length }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Latest Report</div>
        <div class="text-xl font-bold text-gray-900">{{ research[0] ? formatDate(research[0].created_at) : '-' }}</div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading research reports...</div>

    <!-- Research entries -->
    <div v-else-if="research.length" class="space-y-4">
      <div
        v-for="entry in research"
        :key="entry.id"
        class="bg-white rounded-lg shadow overflow-hidden"
      >
        <!-- Header (always visible) -->
        <div
          @click="toggleExpand(entry.id)"
          class="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
        >
          <div class="flex items-center space-x-4">
            <span class="text-2xl">{{ entry.status === 'completed' ? '📊' : entry.status === 'running' ? '⏳' : '❌' }}</span>
            <div>
              <div class="font-medium text-gray-900">
                Research Report — {{ formatDateTime(entry.created_at) }}
              </div>
              <div class="text-sm text-gray-500">
                {{ entry.triggered_by === 'schedule' ? 'Scheduled' : 'Manual' }}
                <span v-if="entry.summary" class="ml-2">— {{ entry.summary?.slice(0, 100) }}...</span>
              </div>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <span
              :class="{
                'bg-green-100 text-green-800': entry.status === 'completed',
                'bg-yellow-100 text-yellow-800': entry.status === 'running',
                'bg-red-100 text-red-800': entry.status === 'failed',
              }"
              class="px-2 py-1 rounded text-xs font-medium"
            >
              {{ entry.status }}
            </span>
            <svg
              class="w-5 h-5 text-gray-400 transition-transform"
              :class="expanded === entry.id ? 'rotate-180' : ''"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <!-- Expanded detail -->
        <div v-if="expanded === entry.id && entry.status === 'completed'" class="border-t px-6 py-4 space-y-6">
          <!-- Summary -->
          <div>
            <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Executive Summary</h3>
            <p class="text-gray-600 whitespace-pre-line">{{ entry.summary }}</p>
          </div>

          <!-- Market Trends -->
          <div v-if="parseTrends(entry).length">
            <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Market Trends</h3>
            <div class="space-y-2">
              <div v-for="(trend, i) in parseTrends(entry)" :key="i" class="flex items-start space-x-2 text-sm">
                <span
                  :class="{
                    'bg-red-100 text-red-700': trend.relevance === 'high',
                    'bg-yellow-100 text-yellow-700': trend.relevance === 'medium',
                    'bg-gray-100 text-gray-600': trend.relevance === 'low',
                  }"
                  class="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5"
                >
                  {{ trend.relevance }}
                </span>
                <span class="text-gray-700">{{ trend.trend }}</span>
              </div>
            </div>
          </div>

          <!-- Competitor Insights -->
          <div v-if="parseCompetitors(entry).length">
            <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Competitor Insights</h3>
            <div class="grid grid-cols-2 gap-3">
              <div
                v-for="(comp, i) in parseCompetitors(entry)"
                :key="i"
                class="border rounded-lg p-3"
              >
                <div class="font-medium text-gray-900 text-sm">{{ comp.competitor }}</div>
                <div class="text-xs text-gray-500 mt-1">{{ comp.platform }}</div>
                <div class="text-sm text-gray-600 mt-1">{{ comp.activity }}</div>
                <div class="text-xs text-blue-600 mt-1">{{ comp.takeaway }}</div>
              </div>
            </div>
          </div>

          <!-- Social Media Highlights -->
          <div v-if="parseSocial(entry).length">
            <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Social Media Highlights</h3>
            <div class="space-y-2">
              <div v-for="(item, i) in parseSocial(entry)" :key="i" class="flex items-start space-x-3 text-sm border-l-2 pl-3" :class="item.platform === 'instagram' ? 'border-pink-400' : 'border-blue-600'">
                <div>
                  <span class="font-medium" :class="item.platform === 'instagram' ? 'text-pink-600' : 'text-blue-700'">{{ item.platform }}</span>
                  <span class="text-gray-500 ml-2">{{ item.engagement }}</span>
                  <p class="text-gray-600 mt-0.5">{{ item.content }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Opportunities & Threats -->
          <div class="grid grid-cols-2 gap-4">
            <div v-if="parseOpportunities(entry).length">
              <h3 class="text-sm font-semibold text-green-700 uppercase tracking-wider mb-2">Opportunities</h3>
              <ul class="space-y-1">
                <li v-for="(opp, i) in parseOpportunities(entry)" :key="i" class="text-sm text-gray-600 flex items-start">
                  <span class="text-green-500 mr-2 mt-0.5">+</span>
                  {{ opp }}
                </li>
              </ul>
            </div>
            <div v-if="parseThreats(entry).length">
              <h3 class="text-sm font-semibold text-red-700 uppercase tracking-wider mb-2">Threats</h3>
              <ul class="space-y-1">
                <li v-for="(threat, i) in parseThreats(entry)" :key="i" class="text-sm text-gray-600 flex items-start">
                  <span class="text-red-500 mr-2 mt-0.5">-</span>
                  {{ threat }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Generate Content button -->
          <div class="pt-2 border-t">
            <button
              @click.stop="generateContent(entry.id)"
              :disabled="isCreatingContent"
              class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
            >
              {{ isCreatingContent ? 'Generating...' : 'Generate Social Content' }}
            </button>
          </div>
        </div>

        <!-- Failed detail -->
        <div v-if="expanded === entry.id && entry.status === 'failed'" class="border-t px-6 py-4">
          <p class="text-red-600 text-sm">{{ entry.error_message || 'Research failed' }}</p>
        </div>
      </div>
    </div>

    <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
      No research reports yet. Click "Run Research Now" to get started.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { researchApi, contentApi } from '../api/client'
import { formatDate, formatDateTime } from '../utils/format'
import { useToastStore } from '../stores/toast'

const toast = useToastStore()

const research = ref<any[]>([])
const loading = ref(true)
const isRunning = ref(false)
const isCreatingContent = ref(false)
const expanded = ref<string | null>(null)

function toggleExpand(id: string) {
  expanded.value = expanded.value === id ? null : id
}

function safeParseJson(str: string | null | undefined): any[] {
  if (!str) return []
  try { return JSON.parse(str) } catch { return [] }
}

function parseTrends(entry: any) { return safeParseJson(entry.trends_json) }
function parseCompetitors(entry: any) { return safeParseJson(entry.competitors_json) }
function parseSocial(entry: any) { return safeParseJson(entry.social_json) }
function parseOpportunities(entry: any) { return safeParseJson(entry.opportunities) }
function parseThreats(entry: any) { return safeParseJson(entry.threats) }

async function fetchResearch() {
  try {
    const res = await researchApi.getAll()
    research.value = res.data
  } catch (e) {
    console.error('Failed to fetch research:', e)
  } finally {
    loading.value = false
  }
}

async function triggerResearch() {
  isRunning.value = true
  try {
    await researchApi.trigger()
    await fetchResearch()
  } catch {
    // Axios interceptor shows the error toast
  } finally {
    isRunning.value = false
  }
}

async function generateContent(researchId: string) {
  isCreatingContent.value = true
  try {
    await contentApi.trigger(researchId)
    toast.addToast('Content drafts created! Check the Content page.', 'success')
  } catch {
    // Axios interceptor shows the error toast
  } finally {
    isCreatingContent.value = false
  }
}

onMounted(fetchResearch)
</script>
