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

          <!-- Image description -->
          <div v-if="item.image_description" class="text-xs text-gray-500 mb-2">
            <span class="font-medium">Image idea:</span> {{ item.image_description }}
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { contentApi } from '../api/client'
import { formatDateTime } from '../utils/format'

const content = ref<any[]>([])
const loading = ref(true)
const isCreating = ref(false)
const platformFilter = ref('')
const statusFilter = ref('')
const editingId = ref<string | null>(null)
const editText = ref('')

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

function startEdit(item: any) {
  editingId.value = item.id
  editText.value = item.post_text
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

async function updateStatus(id: string, status: string) {
  try {
    const res = await contentApi.updateStatus(id, status)
    const idx = content.value.findIndex(c => c.id === id)
    if (idx >= 0) content.value[idx] = res.data
  } catch {
    // Axios interceptor shows the error toast
  }
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

onMounted(fetchContent)
</script>
