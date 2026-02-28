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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, defineComponent, h } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { settingsApi } from '../api/client'

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

// ─── Load ──────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const { data } = await settingsApi.get()
    Object.assign(form, data)
  } catch {
    error.value = 'Failed to load settings'
  }
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
