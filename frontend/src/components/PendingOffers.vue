<template>
  <div v-if="offers.length > 0" class="mb-8">
    <div class="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      <div class="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-lg">📋</span>
          <div>
            <h2 class="text-base font-semibold text-amber-900">Offers Awaiting Approval</h2>
            <p class="text-sm text-amber-700">Review, edit and approve before sending to leads</p>
          </div>
        </div>
        <span class="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
          {{ offers.length }} pending
        </span>
      </div>

      <div class="divide-y divide-gray-100">
        <div v-for="offer in offers" :key="offer.id" class="p-6">
          <!-- Header row -->
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <p class="font-semibold text-gray-900">{{ offer.lead?.company_name || 'Unknown company' }}</p>
              <p class="text-sm text-gray-500">{{ offer.lead?.contact_name }} · {{ offer.lead?.contact_email }}</p>
            </div>
            <span class="text-xs font-medium px-2.5 py-1 rounded-full"
              :class="{
                'bg-blue-50 text-blue-700': offer.action === 'wants_offer',
                'bg-purple-50 text-purple-700': offer.action === 'counter',
                'bg-indigo-50 text-indigo-700': offer.action === 'new_offer',
              }">
              {{ actionLabel(offer.action) }}
            </span>
          </div>

          <!-- Editable offer fields -->
          <div class="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Product / Service</label>
              <input
                v-model="edits[offer.id!].offer_product_name"
                class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
              <input
                v-model.number="edits[offer.id!].offer_quantity"
                type="number" min="1"
                @input="recalc(offer.id!)"
                class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Unit Price (€)</label>
              <input
                v-model.number="edits[offer.id!].offer_unit_price"
                type="number" min="0" step="0.01"
                @input="recalc(offer.id!)"
                class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <!-- Live pricing summary -->
          <div class="grid grid-cols-3 gap-4 mb-4 bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <div>
              <span class="text-gray-500">Subtotal</span>
              <p class="font-semibold">€{{ fmt(computed[offer.id!]?.subtotal) }}</p>
            </div>
            <div>
              <span class="text-gray-500">FPA 24%</span>
              <p class="font-semibold">€{{ fmt(computed[offer.id!]?.fpa) }}</p>
            </div>
            <div>
              <span class="text-gray-500">Total</span>
              <p class="text-lg font-bold text-gray-900">€{{ fmt(computed[offer.id!]?.total) }}</p>
            </div>
          </div>

          <!-- Editable email body -->
          <div class="mb-4">
            <label class="block text-xs font-medium text-gray-500 mb-1">Email body (Greek)</label>
            <textarea
              v-model="edits[offer.id!].reply_body"
              rows="5"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-3">
            <button
              @click="approve(offer)"
              :disabled="busy[offer.id!]"
              class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {{ busy[offer.id!] === 'approving' ? 'Sending…' : '✓ Approve & Send' }}
            </button>
            <button
              @click="reject(offer)"
              :disabled="!!busy[offer.id!]"
              class="px-4 py-2 bg-white text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {{ busy[offer.id!] === 'rejecting' ? 'Rejecting…' : '✕ Reject Draft' }}
            </button>
            <span v-if="errors[offer.id!]" class="text-sm text-red-600">{{ errors[offer.id!] }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { dealsApi } from '../api/client'

interface OfferEdit {
  offer_product_name: string
  offer_quantity: number
  offer_unit_price: number
  reply_body: string
  fpa_rate: number
}

interface Computed {
  subtotal: number
  fpa: number
  total: number
}

const offers = ref<any[]>([])
const edits = reactive<Record<string, OfferEdit>>({})
const computed = reactive<Record<string, Computed>>({})
const busy = reactive<Record<string, string | null>>({})
const errors = reactive<Record<string, string>>({})

function actionLabel(action: string) {
  if (action === 'counter') return 'Counter-offer'
  if (action === 'new_offer') return 'New offer'
  return 'Offer'
}

function fmt(n: number | undefined) {
  if (n == null) return '0.00'
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function recalc(id: string) {
  const e = edits[id]
  const subtotal = (e.offer_quantity || 0) * (e.offer_unit_price || 0)
  const fpa = Math.round(subtotal * e.fpa_rate * 100) / 100
  const total = Math.round((subtotal + fpa) * 100) / 100
  computed[id] = { subtotal, fpa, total }
}

async function load() {
  const { data } = await dealsApi.getPendingOffers()
  offers.value = data
  for (const o of data) {
    edits[o.id] = {
      offer_product_name: o.offer_product_name,
      offer_quantity: o.offer_quantity,
      offer_unit_price: o.offer_unit_price,
      reply_body: o.reply_body,
      fpa_rate: o.offer_fpa_rate,
    }
    recalc(o.id)
    busy[o.id] = null
    errors[o.id] = ''
  }
}

async function approve(offer: any) {
  busy[offer.id] = 'approving'
  errors[offer.id] = ''
  try {
    await dealsApi.approveOffer(offer.deal_id, {
      offer_product_name: edits[offer.id].offer_product_name,
      offer_quantity: edits[offer.id].offer_quantity,
      offer_unit_price: edits[offer.id].offer_unit_price,
      reply_body: edits[offer.id].reply_body,
    })
    await load()
  } catch (err: any) {
    errors[offer.id] = err.response?.data?.error || 'Failed to send offer'
  } finally {
    busy[offer.id] = null
  }
}

async function reject(offer: any) {
  busy[offer.id] = 'rejecting'
  errors[offer.id] = ''
  try {
    await dealsApi.rejectOffer(offer.deal_id)
    await load()
  } catch (err: any) {
    errors[offer.id] = err.response?.data?.error || 'Failed to reject offer'
  } finally {
    busy[offer.id] = null
  }
}

// Expose reload so Dashboard can call it on SSE events
defineExpose({ load })

onMounted(load)
</script>
