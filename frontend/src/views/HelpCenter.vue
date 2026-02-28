<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Hero header -->
    <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-12 px-4">
      <div class="max-w-3xl mx-auto text-center">
        <div class="flex items-center justify-center gap-3 mb-4">
          <img
            v-if="content?.logoPath"
            :src="content.logoPath"
            alt="Logo"
            class="h-12 w-12 rounded-xl object-contain bg-white/10 p-1"
          />
          <span v-else class="text-4xl">🤖</span>
        </div>
        <h1 class="text-3xl font-bold mb-3">{{ content?.companyName || 'Help Center' }}</h1>
        <p v-if="content?.intro" class="text-blue-100 text-lg max-w-xl mx-auto">{{ content.intro }}</p>
      </div>
    </div>

    <div class="max-w-3xl mx-auto px-4 py-10">
      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-5 shadow-sm animate-pulse">
          <div class="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div class="h-3 bg-gray-100 rounded w-full" />
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="text-center py-20">
        <div class="text-5xl mb-4">⚠️</div>
        <p class="text-gray-600 text-lg mb-2">Help center not available yet</p>
        <p class="text-gray-400 text-sm">Complete company setup to generate FAQ content.</p>
      </div>

      <!-- FAQ accordion -->
      <div v-else-if="content?.faqs?.length" class="space-y-3">
        <h2 class="text-xl font-semibold text-gray-800 mb-6">Frequently Asked Questions</h2>
        <div
          v-for="(faq, i) in content.faqs"
          :key="i"
          class="bg-white rounded-xl shadow-sm overflow-hidden"
        >
          <button
            class="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
            @click="toggle(i)"
          >
            <span class="font-medium text-gray-900">{{ faq.question }}</span>
            <span class="text-gray-400 flex-shrink-0 transition-transform duration-200" :class="open === i ? 'rotate-180' : ''">
              ▼
            </span>
          </button>
          <div
            v-show="open === i"
            class="px-5 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-3"
          >
            {{ faq.answer }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { companyApi } from '../api/client'

interface FAQ {
  question: string
  answer: string
}

interface HelpContent {
  companyName: string
  logoPath: string | null
  intro: string
  faqs: FAQ[]
}

const loading = ref(true)
const error = ref(false)
const content = ref<HelpContent | null>(null)
const open = ref<number | null>(null)

function toggle(i: number) {
  open.value = open.value === i ? null : i
}

onMounted(async () => {
  try {
    const res = await companyApi.getHelpCenter()
    content.value = res.data
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>
