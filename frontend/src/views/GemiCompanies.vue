<template>
  <div>
    <PageHeader title="GEMI Companies" :subtitle="`${totalLabel} scraped from the Greek Business Registry`">
      <template #actions>
        <router-link
          to="/settings"
          class="px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          ← Back to Settings
        </router-link>
      </template>
    </PageHeader>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <input
        v-model="search"
        @input="debouncedLoad"
        type="text"
        placeholder="Search by name, AFM, or GEMI number..."
        class="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-72"
      />
      <select
        v-model="statusFilter"
        @change="resetAndLoad"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Statuses</option>
        <option value="Ενεργή">Ενεργή</option>
        <option value="Διαγραφείσα">Διαγραφείσα</option>
        <option value="Αδρανής">Αδρανής</option>
      </select>
      <select
        v-model="legalFormFilter"
        @change="resetAndLoad"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Legal Forms</option>
        <option value="ΙΚΕ">ΙΚΕ</option>
        <option value="ΕΠΕ">ΕΠΕ</option>
        <option value="ΑΕ">ΑΕ</option>
        <option value="ΟΕ">ΟΕ</option>
        <option value="ΕΕ">ΕΕ</option>
        <option value="ΑΤΟΜΙΚΗ">ΑΤΟΜΙΚΗ</option>
      </select>
      <button
        v-if="search || statusFilter || legalFormFilter"
        @click="clearFilters"
        class="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        Clear filters
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading && companies.length === 0" class="text-center py-12 text-gray-400">
      Loading companies...
    </div>

    <!-- Table -->
    <div v-else-if="companies.length" class="bg-white rounded-lg shadow overflow-x-auto">
      <table class="w-full min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AFM</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Legal Form</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chamber</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KAD</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Founded</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="c in companies"
            :key="c.id"
            class="hover:bg-gray-50 cursor-pointer"
            @click="openDetail(c)"
          >
            <td class="px-4 py-3">
              <div class="font-medium text-gray-900 text-sm">{{ c.name }}</div>
              <div v-if="c.title && c.title !== c.name" class="text-xs text-gray-400 truncate max-w-xs">{{ c.title }}</div>
              <div class="text-xs text-gray-400 font-mono">{{ c.gemi_number }}</div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 font-mono">{{ c.afm || '-' }}</td>
            <td class="px-4 py-3 text-sm text-gray-600">{{ c.legal_form || '-' }}</td>
            <td class="px-4 py-3">
              <span
                :class="[
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  c.status === 'Ενεργή' ? 'bg-green-100 text-green-800' :
                  c.status === 'Διαγραφείσα' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-700'
                ]"
              >
                {{ c.status || '-' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{{ c.chamber_name || '-' }}</td>
            <td class="px-4 py-3">
              <div v-if="c.email" class="text-sm text-gray-600 truncate max-w-[180px]">{{ c.email }}</div>
              <div v-if="c.phone" class="text-xs text-gray-400">{{ c.phone }}</div>
              <span v-if="!c.email && !c.phone" class="text-sm text-gray-400">-</span>
            </td>
            <td class="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
              {{ primaryKad(c) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ c.foundation_date || '-' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Load more -->
      <div v-if="lastId" class="px-4 py-3 border-t border-gray-100 text-center">
        <button
          @click="loadMore"
          :disabled="loading"
          class="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg disabled:opacity-50 transition-colors"
        >
          {{ loading ? 'Loading...' : 'Load more' }}
        </button>
      </div>
    </div>

    <!-- Empty -->
    <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
      No companies found. Start the GEMI scraper from the Settings page.
    </div>

    <!-- Detail modal -->
    <div
      v-if="selectedCompany"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      @click.self="selectedCompany = null"
    >
      <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">{{ selectedCompany.name }}</h3>
          <button @click="selectedCompany = null" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-gray-400 text-xs uppercase">GEMI Number</p>
              <p class="font-mono">{{ selectedCompany.gemi_number }}</p>
            </div>
            <div>
              <p class="text-gray-400 text-xs uppercase">AFM</p>
              <p class="font-mono">{{ selectedCompany.afm || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400 text-xs uppercase">Legal Form</p>
              <p>{{ selectedCompany.legal_form || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400 text-xs uppercase">Status</p>
              <p>{{ selectedCompany.status || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400 text-xs uppercase">Founded</p>
              <p>{{ selectedCompany.foundation_date || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400 text-xs uppercase">Chamber</p>
              <p>{{ selectedCompany.chamber_name || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400 text-xs uppercase">Phone</p>
              <p>{{ selectedCompany.phone || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400 text-xs uppercase">Email</p>
              <p>{{ selectedCompany.email || '-' }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-gray-400 text-xs uppercase">Address</p>
              <p>{{ selectedCompany.address || '-' }}</p>
            </div>
            <div v-if="selectedCompany.title" class="col-span-2">
              <p class="text-gray-400 text-xs uppercase">Trade Name</p>
              <p>{{ selectedCompany.title }}</p>
            </div>
          </div>

          <!-- KAD codes -->
          <div v-if="selectedCompany.kad_primary || selectedCompany.kad_secondary">
            <p class="text-gray-400 text-xs uppercase mb-2">KAD Codes (Business Activities)</p>
            <div class="space-y-1">
              <div v-if="parsedPrimaryKad" class="flex items-start gap-2 text-sm">
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 shrink-0">Primary</span>
                <span class="font-mono text-gray-500 shrink-0">{{ parsedPrimaryKad.code }}</span>
                <span class="text-gray-700">{{ parsedPrimaryKad.description }}</span>
              </div>
              <div v-for="(kad, i) in parsedSecondaryKads" :key="i" class="flex items-start gap-2 text-sm">
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 shrink-0">Secondary</span>
                <span class="font-mono text-gray-500 shrink-0">{{ kad.code }}</span>
                <span class="text-gray-700">{{ kad.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { gemiApi } from '../api/client'
import PageHeader from '../components/PageHeader.vue'

interface GemiCompany {
  id: string
  gemi_number: string
  company_id_num: number
  chamber_id: number
  name: string
  title?: string
  afm?: string
  chamber_name?: string
  status?: string
  foundation_date?: string
  phone?: string
  email?: string
  address?: string
  legal_form?: string
  kad_primary?: string
  kad_secondary?: string
}

const companies = ref<GemiCompany[]>([])
const loading = ref(true)
const lastId = ref<string | null>(null)
const totalCount = ref(0)
const search = ref('')
const statusFilter = ref('')
const legalFormFilter = ref('')
const selectedCompany = ref<GemiCompany | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const totalLabel = computed(() => {
  if (totalCount.value > 0) return totalCount.value.toLocaleString()
  return companies.value.length.toLocaleString()
})

function primaryKad(c: GemiCompany): string {
  if (!c.kad_primary) return '-'
  try {
    const parsed = JSON.parse(c.kad_primary)
    return `${parsed.code} — ${parsed.description}`
  } catch {
    return '-'
  }
}

const parsedPrimaryKad = computed(() => {
  if (!selectedCompany.value?.kad_primary) return null
  try { return JSON.parse(selectedCompany.value.kad_primary) } catch { return null }
})

const parsedSecondaryKads = computed(() => {
  if (!selectedCompany.value?.kad_secondary) return []
  try { return JSON.parse(selectedCompany.value.kad_secondary) } catch { return [] }
})

function openDetail(c: GemiCompany) {
  selectedCompany.value = c
}

async function loadCompanies(append = false) {
  loading.value = true
  try {
    const params: any = { limit: 50 }
    if (append && lastId.value) params.startAfter = lastId.value
    if (search.value) params.search = search.value
    if (statusFilter.value) params.status = statusFilter.value
    if (legalFormFilter.value) params.legalForm = legalFormFilter.value

    const { data } = await gemiApi.listCompanies(params)
    if (append) {
      companies.value = [...companies.value, ...data.companies]
    } else {
      companies.value = data.companies
    }
    lastId.value = data.lastId
  } catch (e) {
    console.error('Failed to load GEMI companies:', e)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  loadCompanies(true)
}

function resetAndLoad() {
  lastId.value = null
  loadCompanies()
}

function debouncedLoad() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    resetAndLoad()
  }, 400)
}

function clearFilters() {
  search.value = ''
  statusFilter.value = ''
  legalFormFilter.value = ''
  resetAndLoad()
}

onMounted(async () => {
  // Load count and first page in parallel
  const [countRes] = await Promise.allSettled([
    gemiApi.getCount(),
    loadCompanies(),
  ])
  if (countRes.status === 'fulfilled') {
    totalCount.value = countRes.value.data.total
  }
})
</script>
