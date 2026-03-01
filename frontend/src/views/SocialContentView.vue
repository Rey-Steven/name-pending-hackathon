<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Social Content</h1>
        <p class="text-sm text-gray-500 mt-1">AI-generated content drafts for Instagram and LinkedIn</p>
      </div>
      <button
        @click="triggerContent"
        :disabled="isCreating"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
      >
        {{ isCreating ? 'Creating...' : 'Create Content Now' }}
      </button>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Total</div>
        <div class="text-xl font-bold text-gray-900">{{ content.length }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Drafts</div>
        <div class="text-xl font-bold text-yellow-600">{{ content.filter(c => c.status === 'draft').length }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Approved</div>
        <div class="text-xl font-bold text-blue-600">{{ content.filter(c => c.status === 'approved').length }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-500">Posted</div>
        <div class="text-xl font-bold text-green-600">{{ content.filter(c => c.status === 'posted').length }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center space-x-4 mb-6">
      <select
        v-model="platformFilter"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Platforms</option>
        <option value="instagram">Instagram</option>
        <option value="linkedin">LinkedIn</option>
      </select>
      <select
        v-model="statusFilter"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="approved">Approved</option>
        <option value="posted">Posted</option>
        <option value="archived">Archived</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading content...</div>

    <!-- Content cards -->
    <div v-else-if="filteredContent.length" class="grid grid-cols-2 gap-6">
      <div
        v-for="item in filteredContent"
        :key="item.id"
        class="bg-white rounded-lg shadow overflow-hidden border-l-4"
        :class="item.platform === 'instagram' ? 'border-pink-500' : 'border-blue-700'"
      >
        <div class="p-5">
          <!-- Header -->
          <div class="flex justify-between items-start mb-3">
            <div class="flex items-center space-x-2">
              <span class="text-lg">{{ item.platform === 'instagram' ? '📸' : '💼' }}</span>
              <span
                class="font-semibold text-sm"
                :class="item.platform === 'instagram' ? 'text-pink-600' : 'text-blue-700'"
              >
                {{ item.platform === 'instagram' ? 'Instagram' : 'LinkedIn' }}
              </span>
            </div>
            <span
              :class="{
                'bg-yellow-100 text-yellow-800': item.status === 'draft',
                'bg-blue-100 text-blue-800': item.status === 'approved',
                'bg-green-100 text-green-800': item.status === 'posted',
                'bg-gray-100 text-gray-600': item.status === 'archived',
              }"
              class="px-2 py-1 rounded text-xs font-medium"
            >
              {{ item.status }}
            </span>
          </div>

          <!-- Theme -->
          <div v-if="item.content_theme" class="text-xs text-gray-500 mb-2">
            Theme: {{ item.content_theme }}
          </div>

          <!-- Post text -->
          <div v-if="editingId !== item.id" class="text-sm text-gray-700 whitespace-pre-line mb-3 max-h-48 overflow-y-auto">
            {{ item.post_text }}
          </div>
          <textarea
            v-else
            v-model="editText"
            class="w-full border rounded-lg p-2 text-sm mb-3"
            rows="6"
          />

          <!-- Hashtags -->
          <div v-if="parseHashtags(item).length" class="flex flex-wrap gap-1 mb-3">
            <span
              v-for="(tag, i) in parseHashtags(item)"
              :key="i"
              class="px-2 py-0.5 rounded-full text-xs font-medium"
              :class="item.platform === 'instagram' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'"
            >
              {{ tag }}
            </span>
          </div>

          <!-- Image description (editable) -->
          <div v-if="item.image_description" class="mb-2">
            <div v-if="editingImageDescId !== item.id" class="text-xs text-gray-500">
              <span class="font-medium">Image idea:</span> {{ item.image_description }}
              <button
                @click="startEditImageDesc(item)"
                class="ml-1 text-blue-500 hover:text-blue-700 underline"
              >edit</button>
            </div>
            <div v-else class="space-y-1.5">
              <textarea
                v-model="editImageDesc"
                class="w-full border rounded-lg p-2 text-xs text-gray-700"
                rows="3"
                placeholder="Describe the image you want..."
              />
              <div class="flex space-x-2">
                <button
                  @click="saveImageDesc(item.id)"
                  class="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >Save</button>
                <button
                  @click="editingImageDescId = null"
                  class="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                >Cancel</button>
              </div>
            </div>
          </div>

          <!-- Generated images: loading state -->
          <div v-if="item.image_generation_status === 'generating'" class="mb-3 p-3 bg-blue-50 rounded-lg">
            <div class="flex items-center space-x-2 text-sm text-blue-600">
              <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Generating images...</span>
            </div>
          </div>

          <!-- Generated images: failed state -->
          <div v-else-if="item.image_generation_status === 'failed'" class="mb-3 p-2 bg-red-50 rounded-lg flex items-center justify-between">
            <span class="text-xs text-red-500">Image generation failed</span>
            <button
              @click="regenerateImages(item.id)"
              class="px-2 py-1 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200 font-medium"
            >Retry</button>
          </div>

          <!-- Generated images: completed — selection UI -->
          <div v-else-if="item.image_generation_status === 'completed' && parseImageUrls(item).length" class="mb-3">
            <!-- Already selected: show chosen image -->
            <div v-if="item.selected_image_url && !showingOptions[item.id]" class="relative">
              <div class="text-xs font-medium text-green-600 mb-1 flex items-center space-x-1">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                <span>Selected image</span>
              </div>
              <img
                :src="item.selected_image_url"
                alt="Selected image"
                class="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                @click="modalImage = item.selected_image_url"
              />
              <div class="mt-1 flex items-center space-x-3">
                <button
                  @click="showingOptions[item.id] = true"
                  class="text-xs text-blue-500 hover:text-blue-700 underline"
                >Change selection</button>
                <button
                  @click="regenerateImages(item.id)"
                  class="text-xs text-orange-500 hover:text-orange-700 underline"
                >Regenerate</button>
              </div>
            </div>

            <!-- Not yet selected OR changing: show both options -->
            <div v-else>
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs font-medium text-gray-600">Choose an image:</div>
                <button
                  @click="regenerateImages(item.id)"
                  class="px-2 py-0.5 text-xs text-orange-600 bg-orange-50 rounded hover:bg-orange-100 font-medium"
                >Regenerate</button>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div
                  v-for="(url, i) in parseImageUrls(item)"
                  :key="i"
                  class="relative group"
                >
                  <img
                    :src="url"
                    :alt="`Option ${i + 1}`"
                    class="w-full h-36 object-cover rounded-lg cursor-pointer transition-all"
                    :class="item.selected_image_url === url ? 'ring-2 ring-green-500' : 'hover:ring-2 hover:ring-blue-400'"
                    @click="modalImage = url"
                  />
                  <button
                    @click="selectImage(item.id, url)"
                    class="mt-1.5 w-full px-2 py-1 text-xs font-medium rounded transition-colors"
                    :class="item.selected_image_url === url
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'"
                  >
                    {{ item.selected_image_url === url ? 'Selected' : 'Select' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Posting time & tone -->
          <div class="flex items-center space-x-4 text-xs text-gray-500 mb-4">
            <span v-if="item.best_posting_time">Best time: {{ item.best_posting_time }}</span>
            <span v-if="item.tone">Tone: {{ item.tone }}</span>
          </div>

          <div class="text-xs text-gray-400 mb-3">{{ formatDateTime(item.created_at) }}</div>

          <!-- Actions -->
          <div class="flex items-center space-x-2 pt-3 border-t">
            <template v-if="editingId === item.id">
              <button
                @click="saveEdit(item.id)"
                class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                @click="editingId = null"
                class="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </template>
            <template v-else>
              <button
                v-if="item.status === 'draft'"
                @click="updateStatus(item.id, 'approved')"
                class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Approve
              </button>
              <button
                v-if="item.status === 'approved'"
                @click="updateStatus(item.id, 'posted')"
                class="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              >
                Mark Posted
              </button>
              <button
                v-if="item.status === 'draft' || item.status === 'approved'"
                @click="startEdit(item)"
                class="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
              >
                Edit
              </button>
              <button
                v-if="item.status !== 'archived'"
                @click="updateStatus(item.id, 'archived')"
                class="px-3 py-1.5 text-gray-400 text-xs hover:text-red-500"
              >
                Archive
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
      No content drafts yet. Run market research first, then generate content.
    </div>

    <!-- Full-size image modal -->
    <div
      v-if="modalImage"
      class="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-8"
      @click="modalImage = null"
    >
      <img :src="modalImage" class="max-w-4xl max-h-[90vh] rounded-lg shadow-2xl" @click.stop />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { contentApi } from '../api/client'
import { formatDateTime } from '../utils/format'

const content = ref<any[]>([])
const loading = ref(true)
const isCreating = ref(false)
const platformFilter = ref('')
const statusFilter = ref('')
const editingId = ref<string | null>(null)
const editText = ref('')
const editingImageDescId = ref<string | null>(null)
const editImageDesc = ref('')
const modalImage = ref<string | null>(null)
const showingOptions = reactive<Record<string, boolean>>({})
const pollingTimers: Record<string, number> = {}

const filteredContent = computed(() => {
  let result = content.value
  if (platformFilter.value) {
    result = result.filter(c => c.platform === platformFilter.value)
  }
  if (statusFilter.value) {
    result = result.filter(c => c.status === statusFilter.value)
  }
  return result
})

function parseHashtags(item: any): string[] {
  if (!item.hashtags) return []
  try { return JSON.parse(item.hashtags) } catch { return [] }
}

function parseImageUrls(item: any): string[] {
  if (!item.image_urls) return []
  try { return JSON.parse(item.image_urls) } catch { return [] }
}

function startEdit(item: any) {
  editingId.value = item.id
  editText.value = item.post_text
}

function startEditImageDesc(item: any) {
  editingImageDescId.value = item.id
  editImageDesc.value = item.image_description || ''
}

async function saveEdit(id: string) {
  try {
    await contentApi.update(id, { post_text: editText.value })
    const idx = content.value.findIndex(c => c.id === id)
    if (idx >= 0) content.value[idx].post_text = editText.value
    editingId.value = null
  } catch {
    // Axios interceptor shows the error toast
  }
}

async function saveImageDesc(id: string) {
  try {
    const res = await contentApi.update(id, { image_description: editImageDesc.value } as any)
    const idx = content.value.findIndex(c => c.id === id)
    if (idx >= 0) content.value[idx] = res.data
    editingImageDescId.value = null
  } catch {
    // Axios interceptor shows the error toast
  }
}

async function updateStatus(id: string, status: string) {
  try {
    const res = await contentApi.updateStatus(id, status)
    const idx = content.value.findIndex(c => c.id === id)
    if (idx >= 0) content.value[idx] = res.data

    // Start polling if images are being generated
    if (res.data.image_generation_status === 'generating') {
      startImagePolling(id)
    }
  } catch {
    // Axios interceptor shows the error toast
  }
}

async function selectImage(contentId: string, imageUrl: string) {
  try {
    const res = await contentApi.selectImage(contentId, imageUrl)
    const idx = content.value.findIndex(c => c.id === contentId)
    if (idx >= 0) content.value[idx] = res.data
    showingOptions[contentId] = false
  } catch {
    // Axios interceptor shows the error toast
  }
}

async function regenerateImages(contentId: string) {
  try {
    const res = await contentApi.regenerateImages(contentId)
    const idx = content.value.findIndex(c => c.id === contentId)
    if (idx >= 0) content.value[idx] = res.data
    showingOptions[contentId] = false
    startImagePolling(contentId)
  } catch {
    // Axios interceptor shows the error toast
  }
}

function startImagePolling(contentId: string) {
  if (pollingTimers[contentId]) return

  const timer = window.setInterval(async () => {
    try {
      const res = await contentApi.getById(contentId)
      const updated = res.data
      const idx = content.value.findIndex(c => c.id === contentId)
      if (idx >= 0) content.value[idx] = updated

      if (updated.image_generation_status !== 'generating') {
        clearInterval(pollingTimers[contentId])
        delete pollingTimers[contentId]
      }
    } catch {
      clearInterval(pollingTimers[contentId])
      delete pollingTimers[contentId]
    }
  }, 3000)

  pollingTimers[contentId] = timer
}

async function fetchContent() {
  try {
    const res = await contentApi.getAll()
    content.value = res.data
  } catch (e) {
    console.error('Failed to fetch content:', e)
  } finally {
    loading.value = false
  }
}

async function triggerContent() {
  isCreating.value = true
  try {
    await contentApi.trigger()
    await fetchContent()
  } catch {
    // Axios interceptor shows the error toast
  } finally {
    isCreating.value = false
  }
}

onMounted(async () => {
  await fetchContent()
  // Resume polling for any items still generating (e.g., page refreshed mid-generation)
  content.value
    .filter(c => c.image_generation_status === 'generating')
    .forEach(c => startImagePolling(c.id))
})

onUnmounted(() => {
  Object.values(pollingTimers).forEach(timer => clearInterval(timer))
})
</script>
