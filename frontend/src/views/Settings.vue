<template>
  <div>
    <PageHeader title="Settings" subtitle="Configure automation behaviour and timing" />

    <form @submit.prevent="save" class="space-y-8 max-w-2xl">

      <!-- Email Automation -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 class="text-base font-semibold text-gray-900">📧 Email Automation</h2>
          <p class="text-sm text-gray-500 mt-0.5">Controls how the system monitors and responds to customer emails.</p>
        </div>
        <div class="divide-y divide-gray-100">

          <SettingRow
            label="Reply check interval"
            description="How often the system polls the inbox for customer replies."
            unit="minutes"
          >
            <input v-model.number="form.reply_poll_interval_minutes" type="number" min="1" max="1440" v-bind="inputClass" />
          </SettingRow>

          <SettingRow
            label="Stale lead follow-up threshold"
            description="Days since last update before sending a follow-up to an unresponsive lead."
            unit="days"
          >
            <input v-model.number="form.stale_lead_days" type="number" min="1" max="365" v-bind="inputClass" />
          </SettingRow>

          <SettingRow
            label="Max follow-up attempts"
            description="Number of follow-up emails sent before marking a deal as no-response."
            unit="emails"
          >
            <input v-model.number="form.max_followup_attempts" type="number" min="1" max="10" v-bind="inputClass" />
          </SettingRow>

        </div>
      </div>

      <!-- Deal Lifecycle -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 class="text-base font-semibold text-gray-900">🔄 Deal Lifecycle</h2>
          <p class="text-sm text-gray-500 mt-0.5">Controls when deals are re-engaged or closed out.</p>
        </div>
        <div class="divide-y divide-gray-100">

          <SettingRow
            label="Lost deal reopen threshold"
            description="Days of inactivity before a closed/lost deal is automatically re-entered into the pipeline."
            unit="days"
          >
            <input v-model.number="form.lost_deal_reopen_days" type="number" min="1" max="730" v-bind="inputClass" />
          </SettingRow>

          <SettingRow
            label="Satisfaction email timing"
            description="Days after a deal closes before sending the customer satisfaction email."
            unit="days"
          >
            <input v-model.number="form.satisfaction_email_days" type="number" min="1" max="30" v-bind="inputClass" />
          </SettingRow>

          <SettingRow
            label="Max negotiation rounds"
            description="Maximum number of offer/counter-offer rounds before closing a deal."
            unit="rounds"
          >
            <input v-model.number="form.max_offer_rounds" type="number" min="1" max="10" v-bind="inputClass" />
          </SettingRow>

        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-4">
        <button
          type="submit"
          :disabled="saving"
          class="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {{ saving ? 'Saving…' : 'Save settings' }}
        </button>

        <Transition name="fade">
          <span v-if="saved" class="text-sm text-green-600 font-medium">✓ Settings saved</span>
          <span v-else-if="error" class="text-sm text-red-600">{{ error }}</span>
        </Transition>
      </div>

    </form>

    <!-- GEMI Scraper (outside the settings form — separate controls) -->
    <div class="max-w-2xl mt-8">
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900">GEMI Company Scraper</h2>
            <p class="text-sm text-gray-500 mt-0.5">Enumerates companies from the Greek Business Registry (GEMI). Runs daily.</p>
          </div>
          <span
            :class="[
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              gemi.is_running
                ? 'bg-green-100 text-green-800'
                : gemi.status === 'stopped'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-700',
            ]"
          >
            {{ gemi.is_running ? 'Running' : gemi.status === 'stopped' ? 'Stopped' : 'Idle' }}
          </span>
        </div>

        <div class="px-6 py-4 space-y-4">
          <!-- Stats grid -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-900">{{ gemi.total_companies_found.toLocaleString() }}</p>
              <p class="text-xs text-gray-500 mt-0.5">Total found</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-900">{{ gemi.companies_found_this_run.toLocaleString() }}</p>
              <p class="text-xs text-gray-500 mt-0.5">This run</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-900">{{ gemi.current_company_id?.toLocaleString() || '—' }}</p>
              <p class="text-xs text-gray-500 mt-0.5">Current ID</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-900">{{ gemi.consecutive_misses }}</p>
              <p class="text-xs text-gray-500 mt-0.5">Consecutive misses</p>
            </div>
          </div>

          <!-- Last run info -->
          <div v-if="gemi.last_run_completed_at" class="text-xs text-gray-500">
            Last completed: {{ new Date(gemi.last_run_completed_at).toLocaleString() }}
          </div>
          <div v-if="gemi.last_error" class="text-xs text-red-500">
            Last error: {{ gemi.last_error }}
          </div>

          <!-- Controls -->
          <div class="flex items-center gap-3 pt-2 border-t border-gray-100">
            <button
              v-if="!gemi.is_running"
              @click="startGemi"
              :disabled="gemiLoading"
              class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {{ gemiLoading ? 'Starting…' : 'Start scraper' }}
            </button>
            <button
              v-else
              @click="stopGemi"
              :disabled="gemiLoading"
              class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {{ gemiLoading ? 'Stopping…' : 'Stop scraper' }}
            </button>
            <button
              @click="refreshGemiStatus"
              :disabled="gemiLoading"
              class="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Refresh
            </button>
            <router-link
              to="/gemi-companies"
              class="ml-auto px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              View scraped companies →
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, defineComponent, h } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { settingsApi, gemiApi } from '../api/client'

// ─── Inline sub-component for a setting row ────────────────────

const SettingRow = defineComponent({
  props: {
    label: { type: String, required: true },
    description: { type: String, required: true },
    unit: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'px-6 py-4 flex items-start justify-between gap-6' }, [
        h('div', { class: 'flex-1 min-w-0' }, [
          h('p', { class: 'text-sm font-medium text-gray-900' }, props.label),
          h('p', { class: 'text-sm text-gray-500 mt-0.5' }, props.description),
        ]),
        h('div', { class: 'flex items-center gap-2 shrink-0' }, [
          slots.default?.(),
          h('span', { class: 'text-sm text-gray-400 w-14' }, props.unit),
        ]),
      ])
  },
})

// ─── Input classes ─────────────────────────────────────────────

const inputClass = {
  class: 'w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
}

// ─── State ────────────────────────────────────────────────────

const form = reactive({
  reply_poll_interval_minutes: 30,
  stale_lead_days: 7,
  max_followup_attempts: 3,
  lost_deal_reopen_days: 60,
  satisfaction_email_days: 3,
  max_offer_rounds: 3,
})

const saving = ref(false)
const saved = ref(false)
const error = ref('')

// ─── GEMI Scraper State ──────────────────────────────────────

const gemi = reactive({
  status: 'idle' as string,
  is_running: false,
  total_companies_found: 0,
  companies_found_this_run: 0,
  current_company_id: null as number | null,
  consecutive_misses: 0,
  last_run_completed_at: null as string | null,
  last_error: null as string | null,
})

const gemiLoading = ref(false)
let gemiPollTimer: ReturnType<typeof setInterval> | null = null

async function refreshGemiStatus() {
  try {
    const { data } = await gemiApi.getStatus()
    Object.assign(gemi, data)
  } catch {
    // silent
  }
}

async function startGemi() {
  gemiLoading.value = true
  try {
    await gemiApi.trigger()
    await refreshGemiStatus()
  } catch {
    // silent
  } finally {
    gemiLoading.value = false
  }
}

async function stopGemi() {
  gemiLoading.value = true
  try {
    await gemiApi.stop()
    // Give it a moment to actually stop
    setTimeout(refreshGemiStatus, 2000)
  } catch {
    // silent
  } finally {
    gemiLoading.value = false
  }
}

// ─── Load ──────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const { data } = await settingsApi.get()
    Object.assign(form, data)
  } catch {
    error.value = 'Failed to load settings'
  }

  // Load GEMI status and auto-refresh every 10s
  refreshGemiStatus()
  gemiPollTimer = setInterval(refreshGemiStatus, 10_000)
})

onUnmounted(() => {
  if (gemiPollTimer) clearInterval(gemiPollTimer)
})

// ─── Save ──────────────────────────────────────────────────────

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    const { data } = await settingsApi.update({ ...form })
    Object.assign(form, data)
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch {
    error.value = 'Failed to save settings'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
