<template>
  <div>
    <!-- Not configured state -->
    <div v-if="!configured && !loading" class="bg-white rounded-lg shadow p-12 text-center">
      <div class="text-5xl mb-4">📄</div>
      <h3 class="text-lg font-semibold text-gray-700 mb-2">Elorus Not Configured</h3>
      <p class="text-gray-500 text-sm mb-4">To manage contacts, add your Elorus API credentials in Company Setup.</p>
      <router-link to="/setup" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Go to Company Setup</router-link>
    </div>

    <!-- Configured state -->
    <template v-else-if="configured">
      <PageHeader title="Elorus Contacts" :subtitle="`${totalContacts} contacts`">
        <template #actions>
          <button
            @click="showModal = true"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Add Contact
          </button>
        </template>
      </PageHeader>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">Total Contacts</div>
          <div class="text-xl font-bold text-gray-900">{{ totalContacts }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">Active Contacts</div>
          <div class="text-xl font-bold text-green-600">{{ activeContacts }}</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center space-x-4 mb-6">
        <input
          v-model="search"
          type="text"
          placeholder="Search contacts..."
          class="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
        />
      </div>

      <!-- Table -->
      <div v-if="loading" class="text-center py-12 text-gray-400">Loading contacts...</div>
      <div v-else-if="contacts.length" class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="w-full min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax ID</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="contact in contacts" :key="contact.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 font-medium text-gray-900">{{ contact.company || '-' }}</td>
              <td class="px-4 py-3 text-gray-700">
                {{ contact.display_name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '-' }}
              </td>
              <td class="px-4 py-3 font-mono text-sm text-gray-500">{{ contact.vat_number || '-' }}</td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ contact.email?.[0]?.email || '-' }}</td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ contact.phones?.[0]?.number || '-' }}</td>
              <td class="px-4 py-3">
                <button
                  @click="viewOnElorus(contact.id)"
                  class="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View on Elorus
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
          <div class="text-sm text-gray-500">
            Page {{ page }} of {{ totalPages }}
          </div>
          <div class="flex space-x-2">
            <button
              @click="goToPage(page - 1)"
              :disabled="!hasPrevious"
              class="px-3 py-1 text-sm rounded-lg border"
              :class="hasPrevious ? 'border-gray-300 text-gray-700 hover:bg-gray-100' : 'border-gray-200 text-gray-300 cursor-not-allowed'"
            >
              Previous
            </button>
            <button
              @click="goToPage(page + 1)"
              :disabled="!hasNext"
              class="px-3 py-1 text-sm rounded-lg border"
              :class="hasNext ? 'border-gray-300 text-gray-700 hover:bg-gray-100' : 'border-gray-200 text-gray-300 cursor-not-allowed'"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        No contacts found.
      </div>
    </template>

    <!-- Loading initial status -->
    <div v-else class="text-center py-12 text-gray-400">Loading...</div>

    <!-- Add Contact Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black bg-opacity-50" @click="closeModal"></div>
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative z-10">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Add Contact</h2>
        <form @submit.prevent="submitContact">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Company *</label>
              <input
                v-model="form.company"
                type="text"
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  v-model="form.first_name"
                  type="text"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  v-model="form.last_name"
                  type="text"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tax ID (VAT Number)</label>
              <input
                v-model="form.vat_number"
                type="text"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                v-model="form.email"
                type="email"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                v-model="form.phone"
                type="text"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div class="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="submitting"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {{ submitting ? 'Creating...' : 'Create Contact' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { elorusApi } from '../api/client'
import PageHeader from '../components/PageHeader.vue'

const contacts = ref<any[]>([])
const loading = ref(true)
const configured = ref<boolean | null>(null)
const webBaseUrl = ref('')
const search = ref('')
const page = ref(1)
const totalContacts = ref(0)
const activeContacts = ref(0)
const hasNext = ref(false)
const hasPrevious = ref(false)
const showModal = ref(false)
const submitting = ref(false)

const PAGE_SIZE = 25

const totalPages = computed(() => Math.max(1, Math.ceil(totalContacts.value / PAGE_SIZE)))

const form = ref({
  company: '',
  first_name: '',
  last_name: '',
  vat_number: '',
  email: '',
  phone: '',
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(search, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    fetchContacts()
  }, 300)
})

function goToPage(newPage: number) {
  page.value = newPage
  fetchContacts()
}

function viewOnElorus(contactId: string) {
  const base = webBaseUrl.value || 'https://app.elorus.com'
  window.open(`${base}/contacts/${contactId}/`, '_blank')
}

function closeModal() {
  showModal.value = false
  form.value = { company: '', first_name: '', last_name: '', vat_number: '', email: '', phone: '' }
}

async function submitContact() {
  submitting.value = true
  try {
    const payload: Record<string, any> = {
      company: form.value.company,
      first_name: form.value.first_name || undefined,
      last_name: form.value.last_name || undefined,
      vat_number: form.value.vat_number || undefined,
    }
    if (form.value.email) {
      payload.email = [{ email: form.value.email, primary: true }]
    }
    if (form.value.phone) {
      payload.phones = [{ number: form.value.phone, primary: true }]
    }
    await elorusApi.createContact(payload)
    closeModal()
    page.value = 1
    await fetchContacts()
  } catch (e) {
    console.error('Failed to create contact:', e)
  } finally {
    submitting.value = false
  }
}

async function fetchContacts() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value }
    if (search.value) {
      params.search = search.value
    }
    const res = await elorusApi.listContacts(params)
    const data = res.data
    contacts.value = data.results || data
    totalContacts.value = data.count || contacts.value.length
    hasNext.value = !!data.next
    hasPrevious.value = !!data.previous
    // Count active contacts (those with is_active true or no is_active field)
    activeContacts.value = contacts.value.filter((c: any) => c.is_active !== false).length
    // If we have a total count and this is page 1 with no search, use it for active estimate
    if (page.value === 1 && !search.value && data.count) {
      activeContacts.value = data.count
    }
  } catch (e) {
    console.error('Failed to fetch contacts:', e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const statusRes = await elorusApi.status()
    const statusData = statusRes.data
    configured.value = !!statusData.configured
    webBaseUrl.value = statusData.webBaseUrl || ''
    if (configured.value) {
      await fetchContacts()
    } else {
      loading.value = false
    }
  } catch (e) {
    console.error('Failed to check Elorus status:', e)
    configured.value = false
    loading.value = false
  }
})
</script>
