<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">

      <!-- Header -->
      <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
        <h1 class="text-2xl font-bold">Welcome to AgentFlow</h1>
        <p class="text-blue-100 mt-1">Let's set up your AI-powered company in minutes</p>
        <!-- Progress bar -->
        <div class="mt-4 flex gap-2">
          <div
            v-for="s in 4"
            :key="s"
            class="h-1.5 flex-1 rounded-full transition-all duration-500"
            :class="s <= currentStep ? 'bg-white' : 'bg-blue-400'"
          />
        </div>
        <div class="mt-2 text-xs text-blue-100">Step {{ currentStep }} of 4</div>
      </div>

      <!-- Step 1: Basic Info -->
      <div v-if="currentStep === 1" class="p-8">
        <h2 class="text-xl font-semibold text-gray-900 mb-1">Tell us about your company</h2>
        <p class="text-gray-500 text-sm mb-6">We'll use this to tailor your AI team to your business.</p>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Company Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. Acme Corp"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              v-model="form.website"
              type="url"
              placeholder="https://yourcompany.com"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-gray-400 mt-1">We'll scrape this for company intelligence</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <input
              v-model="form.industry"
              type="text"
              placeholder="e.g. B2B SaaS, Healthcare, Manufacturing..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Describe your company
            </label>
            <textarea
              v-model="form.userText"
              rows="4"
              placeholder="Tell us what you do, who your customers are, what makes you unique, and any important context your AI team should know..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div class="mt-8 flex justify-end">
          <button
            @click="goToStep2"
            :disabled="!form.name"
            class="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue →
          </button>
        </div>
      </div>

      <!-- Step 2: Brand & Documents -->
      <div v-if="currentStep === 2" class="p-8">
        <h2 class="text-xl font-semibold text-gray-900 mb-1">Brand & documents</h2>
        <p class="text-gray-500 text-sm mb-6">
          Upload your logo and any documents (pitch deck, brochures, product overview) to give your AI team deeper context.
        </p>

        <!-- Logo upload -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
          <div
            class="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
            @click="logoInput?.click()"
            @dragover.prevent
            @drop.prevent="handleLogoDrop"
          >
            <div v-if="logoPreview">
              <img :src="logoPreview" alt="Logo preview" class="h-20 mx-auto object-contain mb-2 rounded" />
              <p class="text-sm text-gray-600">{{ logoFile?.name }}</p>
              <button @click.stop="removeLogo" class="text-xs text-red-500 hover:underline mt-1">Remove</button>
            </div>
            <div v-else>
              <div class="text-4xl mb-2">🖼️</div>
              <p class="text-sm text-gray-600">Drop your logo here or <span class="text-blue-600 font-medium">browse</span></p>
              <p class="text-xs text-gray-400 mt-1">PNG, JPG, SVG, WebP — max 5MB</p>
            </div>
          </div>
          <input ref="logoInput" type="file" accept="image/*" class="hidden" @change="handleLogoSelect" />
        </div>

        <!-- Documents upload -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Supporting Documents</label>
          <div
            class="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
            @click="docInput?.click()"
            @dragover.prevent
            @drop.prevent="handleDocsDrop"
          >
            <div class="text-4xl mb-2">📄</div>
            <p class="text-sm text-gray-600">Drop PDFs here or <span class="text-blue-600 font-medium">browse</span></p>
            <p class="text-xs text-gray-400 mt-1">PDF, TXT — up to 10 files, max 20MB each</p>
          </div>
          <input ref="docInput" type="file" accept=".pdf,.txt,text/plain,application/pdf" multiple class="hidden" @change="handleDocsSelect" />

          <!-- Document list -->
          <ul v-if="documents.length > 0" class="mt-3 space-y-2">
            <li
              v-for="(doc, i) in documents"
              :key="i"
              class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
            >
              <span class="text-gray-700 flex items-center gap-2">
                <span>📄</span> {{ doc.name }}
                <span class="text-gray-400 text-xs">({{ (doc.size / 1024).toFixed(0) }} KB)</span>
              </span>
              <button @click="removeDoc(i)" class="text-red-400 hover:text-red-600 ml-4">✕</button>
            </li>
          </ul>
        </div>

        <div class="mt-8 flex justify-between">
          <button
            @click="currentStep = 1"
            class="px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            ← Back
          </button>
          <button
            @click="startAnalysis"
            class="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Analyze & Build AI Team →
          </button>
        </div>
      </div>

      <!-- Step 3: Analyzing -->
      <div v-if="currentStep === 3" class="p-8 text-center">
        <div class="text-6xl mb-6 animate-bounce">🤖</div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Building your AI team...</h2>
        <p class="text-gray-500 text-sm mb-8">This usually takes 15-30 seconds</p>

        <div class="space-y-3 text-left max-w-sm mx-auto">
          <div
            v-for="(step, i) in analysisSteps"
            :key="i"
            class="flex items-center gap-3 p-3 rounded-lg transition-all duration-300"
            :class="getStepClass(i)"
          >
            <span class="text-lg flex-shrink-0">
              <span v-if="analysisProgress > i">✅</span>
              <span v-else-if="analysisProgress === i" class="inline-block animate-spin">⚙️</span>
              <span v-else class="opacity-30">⏳</span>
            </span>
            <div>
              <p class="text-sm font-medium" :class="analysisProgress >= i ? 'text-gray-900' : 'text-gray-400'">
                {{ step.label }}
              </p>
              <p v-if="analysisProgress === i" class="text-xs text-blue-600 mt-0.5">In progress...</p>
            </div>
          </div>
        </div>

        <div v-if="setupError" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
          <p class="text-sm font-medium text-red-800">Something went wrong</p>
          <p class="text-xs text-red-600 mt-1">{{ setupError }}</p>
          <button
            @click="currentStep = 1"
            class="mt-3 text-sm text-red-700 hover:underline font-medium"
          >
            ← Go back and try again
          </button>
        </div>
      </div>

      <!-- Step 4: Review & Confirm -->
      <div v-if="currentStep === 4" class="p-8">
        <div class="flex items-center gap-3 mb-6">
          <span class="text-4xl">🎉</span>
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Your AI team is ready!</h2>
            <p class="text-gray-500 text-sm">Review what we discovered about your company</p>
          </div>
        </div>

        <div v-if="companyStore.profile" class="space-y-4">
          <!-- Company overview -->
          <div class="bg-gray-50 rounded-xl p-4">
            <div class="flex items-center gap-3 mb-3">
              <img
                v-if="companyStore.logoUrl"
                :src="companyStore.logoUrl"
                alt="Logo"
                class="h-12 w-12 rounded-lg object-contain bg-white border"
              />
              <div v-else class="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center text-xl">🏢</div>
              <div>
                <h3 class="font-semibold text-gray-900">{{ companyStore.profile.name }}</h3>
                <p class="text-sm text-gray-500">{{ companyStore.profile.industry }}</p>
              </div>
            </div>
            <p class="text-sm text-gray-700">{{ companyStore.profile.description }}</p>
            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div v-if="companyStore.profile.business_model" class="bg-white rounded-lg p-2">
                <span class="text-gray-400">Model</span>
                <p class="font-medium text-gray-700">{{ companyStore.profile.business_model }}</p>
              </div>
              <div v-if="companyStore.profile.geographic_focus" class="bg-white rounded-lg p-2">
                <span class="text-gray-400">Geography</span>
                <p class="font-medium text-gray-700">{{ companyStore.profile.geographic_focus }}</p>
              </div>
              <div v-if="companyStore.profile.target_customers" class="bg-white rounded-lg p-2 col-span-2">
                <span class="text-gray-400">Target Customers</span>
                <p class="font-medium text-gray-700">{{ companyStore.profile.target_customers }}</p>
              </div>
            </div>
          </div>

          <!-- Agent contexts (collapsible) -->
          <div>
            <button
              @click="showAgentContexts = !showAgentContexts"
              class="w-full text-left flex items-center justify-between p-3 bg-blue-50 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <span>🤖 View AI team customizations</span>
              <span>{{ showAgentContexts ? '▲' : '▼' }}</span>
            </button>
            <div v-if="showAgentContexts" class="mt-2 space-y-2">
              <div
                v-for="agent in agentList"
                :key="agent.key"
                class="bg-gray-50 rounded-lg p-3"
              >
                <p class="text-xs font-semibold text-gray-600 mb-1">{{ agent.icon }} {{ agent.label }}</p>
                <p class="text-xs text-gray-600 leading-relaxed">
                  {{ getAgentContext(agent.key) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-8 flex justify-between">
          <button
            @click="currentStep = 1"
            class="px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            ✏️ Edit
          </button>
          <button
            @click="goToDashboard"
            class="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Launch Dashboard 🚀
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCompanyStore } from '../stores/company'

const router = useRouter()
const companyStore = useCompanyStore()

const currentStep = ref(1)
const showAgentContexts = ref(false)
const setupError = ref<string | null>(null)
const analysisProgress = ref(-1)

const form = ref({
  name: '',
  website: '',
  industry: '',
  userText: '',
})

// File state
const logoFile = ref<File | null>(null)
const logoPreview = ref<string | null>(null)
const documents = ref<File[]>([])
const logoInput = ref<HTMLInputElement | null>(null)
const docInput = ref<HTMLInputElement | null>(null)

const analysisSteps = [
  { label: 'Fetching website content' },
  { label: 'Processing documents' },
  { label: 'Crafting your AI team with Claude' },
  { label: 'Saving company profile' },
]

const agentList = [
  { key: 'marketing', icon: '🎯', label: 'Marketing Agent' },
  { key: 'sales', icon: '💼', label: 'Sales Agent' },
  { key: 'legal', icon: '⚖️', label: 'Legal Agent' },
  { key: 'accounting', icon: '📊', label: 'Accounting Agent' },
  { key: 'email', icon: '📧', label: 'Email Agent' },
]

function getAgentContext(key: string): string {
  const ctx = companyStore.profile?.agent_context_json
  if (!ctx) return ''
  return (ctx as any)[key] || ''
}

function getStepClass(i: number) {
  if (analysisProgress.value > i) return 'bg-green-50'
  if (analysisProgress.value === i) return 'bg-blue-50 ring-1 ring-blue-200'
  return ''
}

function goToStep2() {
  if (!form.value.name.trim()) return
  currentStep.value = 2
}

// Logo handling
function handleLogoSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) setLogoFile(file)
}

function handleLogoDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) setLogoFile(file)
}

function setLogoFile(file: File) {
  logoFile.value = file
  const reader = new FileReader()
  reader.onload = (e) => { logoPreview.value = e.target?.result as string }
  reader.readAsDataURL(file)
}

function removeLogo() {
  logoFile.value = null
  logoPreview.value = null
  if (logoInput.value) logoInput.value.value = ''
}

// Document handling
function handleDocsSelect(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  addDocuments(files)
}

function handleDocsDrop(e: DragEvent) {
  const files = Array.from(e.dataTransfer?.files || [])
  addDocuments(files)
}

function addDocuments(files: File[]) {
  const valid = files.filter(f =>
    f.type === 'application/pdf' || f.type.startsWith('text/')
  )
  documents.value = [...documents.value, ...valid].slice(0, 10)
}

function removeDoc(index: number) {
  documents.value.splice(index, 1)
}

async function startAnalysis() {
  currentStep.value = 3
  setupError.value = null
  analysisProgress.value = 0

  // Simulate step progression while the API call runs
  const stepTimer = setInterval(() => {
    if (analysisProgress.value < 2) {
      analysisProgress.value++
    }
  }, 4000)

  try {
    const formData = new FormData()
    formData.append('name', form.value.name)
    if (form.value.website) formData.append('website', form.value.website)
    if (form.value.industry) formData.append('industry', form.value.industry)
    if (form.value.userText) formData.append('userText', form.value.userText)
    if (logoFile.value) formData.append('logo', logoFile.value)
    documents.value.forEach(doc => formData.append('documents', doc))

    await companyStore.setupCompany(formData)

    clearInterval(stepTimer)
    analysisProgress.value = 3
    await new Promise(r => setTimeout(r, 800))
    currentStep.value = 4
  } catch (err: any) {
    clearInterval(stepTimer)
    setupError.value = companyStore.error || 'Unknown error occurred'
  }
}

function goToDashboard() {
  router.push('/dashboard')
}
</script>
