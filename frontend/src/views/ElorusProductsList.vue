<template>
  <div>
    <PageHeader title="Products & Stock" :subtitle="configured ? `${totalProducts} products` : ''" />

    <!-- Not configured state -->
    <div v-if="!loading && !configured" class="bg-white rounded-lg shadow p-12 text-center">
      <div class="text-5xl mb-4">📄</div>
      <h3 class="text-lg font-semibold text-gray-700 mb-2">Elorus Not Configured</h3>
      <p class="text-gray-500 text-sm mb-4">To view products and stock, add your Elorus API credentials in Company Setup.</p>
      <router-link to="/setup" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Go to Company Setup</router-link>
    </div>

    <!-- Configured state -->
    <template v-if="configured">
      <!-- Summary cards -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">Total Products</div>
          <div class="text-xl font-bold text-gray-900">{{ totalProducts }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">In Stock</div>
          <div class="text-xl font-bold text-green-600">{{ inStockCount }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-500">Out of Stock</div>
          <div class="text-xl font-bold text-red-600">{{ outOfStockCount }}</div>
        </div>
      </div>

      <!-- Search bar -->
      <div class="flex items-center space-x-4 mb-6">
        <input
          v-model="search"
          type="text"
          placeholder="Search by title or code..."
          class="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
        />
      </div>

      <!-- Table -->
      <div v-if="loadingProducts" class="text-center py-12 text-gray-400">Loading products...</div>
      <div v-else-if="products.length" class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="w-full min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="product in products" :key="product.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 font-mono font-medium text-gray-900">{{ product.code || '-' }}</td>
              <td class="px-4 py-3 font-medium text-gray-900">{{ product.title }}</td>
              <td class="px-4 py-3 text-gray-500 text-sm">{{ truncate(product.description, 60) }}</td>
              <td class="px-4 py-3 text-right text-sm">{{ formatCurrency(parseFloat(product.sale_value || '0')) }}</td>
              <td class="px-4 py-3 text-center">
                <span v-if="!product.manage" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">N/A</span>
                <span v-else-if="parseFloat(product.stock || '0') > 0" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{{ product.stock }}</span>
                <span v-else class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">0</span>
              </td>
              <td class="px-4 py-3 text-gray-500 text-sm">{{ product.unit_measure || '-' }}</td>
              <td class="px-4 py-3 text-center">
                <span
                  class="inline-block w-2.5 h-2.5 rounded-full"
                  :class="product.active ? 'bg-green-500' : 'bg-gray-300'"
                ></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        No products match your search.
      </div>

      <!-- Pagination -->
      <div v-if="products.length" class="flex items-center justify-between mt-4">
        <div class="text-sm text-gray-500">
          Showing {{ products.length }} of {{ totalCount }} products
        </div>
        <div class="flex space-x-2">
          <button
            :disabled="!hasPrevious"
            @click="goToPrevious"
            class="px-4 py-2 text-sm font-medium rounded-lg border"
            :class="hasPrevious ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'"
          >
            Previous
          </button>
          <button
            :disabled="!hasNext"
            @click="goToNext"
            class="px-4 py-2 text-sm font-medium rounded-lg border"
            :class="hasNext ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'"
          >
            Next
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { elorusApi } from '../api/client'
import { formatCurrency } from '../utils/format'
import PageHeader from '../components/PageHeader.vue'

const configured = ref(false)
const loading = ref(true)
const loadingProducts = ref(false)
const products = ref<any[]>([])
const search = ref('')
const currentPage = ref(1)
const totalCount = ref(0)
const hasNext = ref(false)
const hasPrevious = ref(false)

let searchTimeout: ReturnType<typeof setTimeout> | null = null

const totalProducts = computed(() => totalCount.value)
const inStockCount = computed(() =>
  products.value.filter(p => p.manage && parseFloat(p.stock || '0') > 0).length
)
const outOfStockCount = computed(() =>
  products.value.filter(p => p.manage && parseFloat(p.stock || '0') <= 0).length
)

function truncate(text: string | undefined, maxLength: number): string {
  if (!text) return '-'
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

async function fetchProducts() {
  loadingProducts.value = true
  try {
    const params: Record<string, any> = { page: currentPage.value }
    if (search.value) {
      params.search = search.value
    }
    const res = await elorusApi.listProducts(params)
    const data = res.data
    products.value = data.results || []
    totalCount.value = data.count || 0
    hasNext.value = !!data.next
    hasPrevious.value = !!data.previous
  } catch (e) {
    console.error('Failed to fetch products:', e)
  } finally {
    loadingProducts.value = false
  }
}

function goToNext() {
  if (hasNext.value) {
    currentPage.value++
    fetchProducts()
  }
}

function goToPrevious() {
  if (hasPrevious.value && currentPage.value > 1) {
    currentPage.value--
    fetchProducts()
  }
}

// Debounced search
watch(search, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchProducts()
  }, 300)
})

onMounted(async () => {
  try {
    const statusRes = await elorusApi.status()
    configured.value = statusRes.data.configured === true
  } catch (e) {
    console.error('Failed to check Elorus status:', e)
    configured.value = false
  } finally {
    loading.value = false
  }

  if (configured.value) {
    await fetchProducts()
  }
})
</script>
