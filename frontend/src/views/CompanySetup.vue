<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">

      <!-- Header -->
      <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
        <h1 class="text-2xl font-bold">{{ isEditMode ? 'Company Settings' : 'Welcome to AgentFlow' }}</h1>
        <p class="text-blue-100 mt-1">{{ isEditMode ? 'Update your company profile and AI team context' : 'Let\'s set up your AI-powered company in minutes' }}</p>
        <div class="mt-4 flex gap-2">
          <div
            v-for="s in TOTAL_STEPS"
            :key="s"
            class="h-1.5 flex-1 rounded-full transition-all duration-500"
            :class="s <= currentStep ? 'bg-white' : 'bg-blue-400'"
          />
        </div>
        <div class="mt-2 text-xs text-blue-100">Step {{ currentStep }} of {{ TOTAL_STEPS }}</div>
      </div>

      <!-- ─── Step 1: Basic Info ────────────────────────────────── -->
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
            <label class="block text-sm font-medium text-gray-700 mb-1">GEMI Number</label>
            <input
              v-model="form.gemiNumber"
              type="text"
              placeholder="e.g. 123456703000"
              maxlength="12"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-gray-400 mt-1">Optional — if provided, we'll fetch your real KAD codes from the Greek Business Registry (GEMI)</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Describe your company</label>
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
            @click="goToStep(2)"
            :disabled="!form.name"
            class="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue →
          </button>
        </div>
      </div>

      <!-- ─── Step 2: Products & Pricing ───────────────────────── -->
      <div v-if="currentStep === 2" class="p-8">
        <h2 class="text-xl font-semibold text-gray-900 mb-1">Products & Pricing</h2>
        <p class="text-gray-500 text-sm mb-6">
          Help your AI sales and email agents understand what you sell and how you price it.
        </p>

        <div class="space-y-5">
          <!-- Pricing model + language row -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Pricing Model</label>
              <select
                v-model="form.pricingModel"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Select —</option>
                <option value="one_time">One-time payment</option>
                <option value="subscription">Subscription / recurring</option>
                <option value="project_based">Project-based</option>
                <option value="hourly">Hourly / time & materials</option>
                <option value="retainer">Retainer</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email Language</label>
              <select
                v-model="form.communicationLanguage"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Greek">Greek</option>
                <option value="English">English</option>
                <option value="Greek and English">Greek and English</option>
              </select>
            </div>
          </div>

          <!-- Deal value range -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Typical Deal Value Range (€)</label>
            <div class="flex items-center gap-3">
              <input
                v-model.number="form.minDealValue"
                type="number"
                min="0"
                placeholder="Min (e.g. 500)"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-gray-400 text-sm">to</span>
              <input
                v-model.number="form.maxDealValue"
                type="number"
                min="0"
                placeholder="Max (e.g. 50000)"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p class="text-xs text-gray-400 mt-1">Used to calibrate offer amounts in the sales pipeline</p>
          </div>

          <!-- Key products/services -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">Key Products / Services</label>
              <button
                v-if="form.keyProducts.length < 10"
                @click="addProduct"
                class="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add
              </button>
            </div>

            <div v-if="form.keyProducts.length === 0" class="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
              <p class="text-sm text-gray-400">No products added yet</p>
              <button @click="addProduct" class="mt-2 text-sm text-blue-600 font-medium hover:underline">+ Add your first product</button>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(product, i) in form.keyProducts"
                :key="i"
                class="border border-gray-200 rounded-xl p-3 bg-gray-50"
              >
                <div class="flex gap-2 mb-2">
                  <input
                    v-model="product.name"
                    type="text"
                    placeholder="Product/service name"
                    class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    v-model.number="product.price"
                    type="number"
                    min="0"
                    placeholder="€ price"
                    class="w-28 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button @click="removeProduct(i)" class="text-gray-400 hover:text-red-500 px-1">✕</button>
                </div>
                <input
                  v-model="product.description"
                  type="text"
                  placeholder="Brief description (what it does, who it's for)"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <!-- Elorus Integration -->
          <div class="border-t border-gray-200 pt-5">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-lg">📄</span>
              <label class="text-sm font-semibold text-gray-700">Elorus Integration</label>
              <span class="text-xs text-gray-400">(optional — for invoicing & offers)</span>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                <input
                  v-model="form.elorusApiKey"
                  type="password"
                  :placeholder="elorusKeyConfigured ? '••••••••  (already configured)' : 'Your Elorus API token'"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Organization ID</label>
                <input
                  v-model="form.elorusOrganizationId"
                  type="text"
                  placeholder="e.g. 128759403567807"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <div class="mt-3">
              <label class="block text-xs font-medium text-gray-600 mb-1">Elorus Base URL</label>
              <input
                v-model="form.elorusBaseUrl"
                type="text"
                placeholder="e.g. https://demo-2249XXXXXX6769.elorus.com"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div class="mt-2 flex items-center gap-2">
              <button
                type="button"
                @click="testElorusConnection"
                :disabled="(!form.elorusApiKey && !elorusKeyConfigured) || !form.elorusOrganizationId || testingElorus"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :class="elorusTestResult === true ? 'border-green-300 bg-green-50 text-green-700' : elorusTestResult === false ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
              >
                {{ testingElorus ? 'Testing...' : elorusTestResult === true ? 'Connected' : elorusTestResult === false ? 'Failed — retry' : 'Test Connection' }}
              </button>
              <span v-if="elorusTestMessage" class="text-xs" :class="elorusTestResult ? 'text-green-600' : 'text-red-500'">{{ elorusTestMessage }}</span>
            </div>

            <p class="text-xs text-gray-400 mt-2">Find your API key in Elorus → User Profile. Organization ID is in your Elorus URL.</p>
          </div>

          <!-- Unique selling points -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Unique Selling Points</label>
            <textarea
              v-model="form.uniqueSellingPoints"
              rows="3"
              placeholder="What makes you different? List one per line, e.g.:&#10;- 24/7 dedicated support&#10;- On-premise deployment option&#10;- Fixed-price guarantee"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
            />
            <p class="text-xs text-gray-400 mt-1">Your email agent will weave these into cold outreach and proposals</p>
          </div>
        </div>

        <div class="mt-8 flex justify-between">
          <button @click="goToStep(1)" class="px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium">← Back</button>
          <button
            @click="goToStep(3)"
            class="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Continue →
          </button>
        </div>
      </div>

      <!-- ─── Step 3: Brand & Documents ────────────────────────── -->
      <div v-if="currentStep === 3" class="p-8">
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
          <button @click="goToStep(2)" class="px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium">← Back</button>
          <button
            @click="startAnalysis"
            class="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Analyze & Build AI Team →
          </button>
        </div>
      </div>

      <!-- ─── Step 4: Analyzing ─────────────────────────────────── -->
      <div v-if="currentStep === 4" class="p-8 text-center">
        <div class="text-6xl mb-6 animate-bounce">🤖</div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Building your AI team...</h2>
        <p class="text-gray-500 text-sm mb-8">This usually takes 30-120 seconds</p>

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
          <button @click="goToStep(1)" class="mt-3 text-sm text-red-700 hover:underline font-medium">
            ← Go back and try again
          </button>
        </div>
      </div>

      <!-- ─── Step 5: Review ────────────────────────────────────── -->
      <div v-if="currentStep === 5" class="p-8">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-4xl">🎉</span>
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Your AI team is ready!</h2>
            <p class="text-gray-500 text-sm">Review what we discovered about your company</p>
          </div>
        </div>

        <!-- "New company activated" notice (only when there were other companies before) -->
        <div v-if="hadExistingCompanies" class="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          ✅ Saved as a new company profile and set as active. Switch companies anytime from the top-left menu.
        </div>

        <div v-if="companyStore.profile" class="space-y-4">
          <!-- Company overview -->
          <div class="bg-gray-50 rounded-xl p-4">
            <div class="flex items-center gap-3 mb-3">
              <img v-if="companyStore.logoUrl" :src="companyStore.logoUrl" alt="Logo" class="h-12 w-12 rounded-lg object-contain bg-white border" />
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
              <div v-if="companyStore.profile.pricing_model" class="bg-white rounded-lg p-2">
                <span class="text-gray-400">Pricing</span>
                <p class="font-medium text-gray-700">{{ pricingModelLabel(companyStore.profile.pricing_model) }}</p>
              </div>
              <div v-if="companyStore.profile.min_deal_value || companyStore.profile.max_deal_value" class="bg-white rounded-lg p-2">
                <span class="text-gray-400">Deal Range</span>
                <p class="font-medium text-gray-700">
                  €{{ companyStore.profile.min_deal_value?.toLocaleString() ?? 0 }} –
                  €{{ companyStore.profile.max_deal_value?.toLocaleString() ?? '?' }}
                </p>
              </div>
              <div v-if="companyStore.profile.communication_language" class="bg-white rounded-lg p-2">
                <span class="text-gray-400">Email Language</span>
                <p class="font-medium text-gray-700">{{ companyStore.profile.communication_language }}</p>
              </div>
            </div>
          </div>

          <!-- Key products chips -->
          <div v-if="parsedKeyProducts.length > 0" class="bg-gray-50 rounded-xl p-4">
            <p class="text-sm font-semibold text-gray-700 mb-2">📦 Key Products / Services</p>
            <div class="space-y-2">
              <div
                v-for="p in parsedKeyProducts"
                :key="p.name"
                class="bg-white rounded-lg px-3 py-2 text-sm flex items-start justify-between"
              >
                <div>
                  <span class="font-medium text-gray-800">{{ p.name }}</span>
                  <span v-if="p.price" class="ml-2 text-green-700 font-medium text-xs">€{{ p.price.toLocaleString() }}</span>
                  <p v-if="p.description" class="text-xs text-gray-500 mt-0.5">{{ p.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- KAD Codes -->
          <div v-if="parsedKadCodes.length > 0" class="bg-gray-50 rounded-xl p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-gray-700">🏛️ KAD Codes (Greek Business Activity)</p>
                <span
                  v-if="companyStore.profile?.gemi_number"
                  class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium"
                >
                  GEMI verified
                </span>
              </div>
              <button v-if="isEditMode" @click="editingKad = !editingKad" class="text-xs text-blue-600 hover:underline">
                {{ editingKad ? 'Cancel' : 'Edit' }}
              </button>
            </div>
            <div v-if="!editingKad" class="flex flex-wrap gap-2">
              <span
                v-for="kad in parsedKadCodes"
                :key="kad.code"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
              >
                <span class="font-bold">{{ kad.code }}</span>
                <span class="text-blue-600">{{ kad.description }}</span>
              </span>
            </div>
            <div v-else class="space-y-2">
              <textarea
                v-model="kadEditText"
                rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder='[{"code":"6201","description":"Computer programming activities"}]'
              />
              <button
                @click="saveKadCodes"
                :disabled="savingKad"
                class="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {{ savingKad ? 'Saving...' : 'Save KAD Codes' }}
              </button>
            </div>
          </div>

          <!-- Elorus Integration (per-company) -->
          <div class="bg-gray-50 rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-gray-700">📄 Elorus Integration</p>
                <span
                  v-if="elorusConnected"
                  class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium"
                >
                  Connected
                </span>
                <span
                  v-else
                  class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium"
                >
                  Not configured
                </span>
              </div>
            </div>
            <p class="text-xs text-gray-500 mb-3">Connect your Elorus account to manage invoices, offers, products, and contacts.</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                <input
                  v-model="form.elorusApiKey"
                  type="password"
                  :placeholder="elorusKeyConfigured ? '••••••••  (already configured)' : 'Your Elorus API token'"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Organization ID</label>
                <input
                  v-model="form.elorusOrganizationId"
                  type="text"
                  placeholder="e.g. 128759403567807"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                />
              </div>
            </div>
            <div class="mt-3">
              <label class="block text-xs font-medium text-gray-600 mb-1">Elorus Base URL</label>
              <input
                v-model="form.elorusBaseUrl"
                type="text"
                placeholder="e.g. https://demo-2249XXXXXX6769.elorus.com"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              />
            </div>
            <div class="mt-3 flex items-center gap-2">
              <button
                type="button"
                @click="saveElorusCreds"
                :disabled="(!form.elorusApiKey && !elorusKeyConfigured) || !form.elorusOrganizationId || savingElorus"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ savingElorus ? 'Saving...' : 'Save & Test Connection' }}
              </button>
              <span v-if="elorusSaveMessage" class="text-xs" :class="elorusSaveSuccess ? 'text-green-600' : 'text-red-500'">{{ elorusSaveMessage }}</span>
            </div>
            <p class="text-xs text-gray-400 mt-2">Find your API key in Elorus → User Profile. Organization ID is in your Elorus URL.</p>
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
              <div v-for="agent in agentList" :key="agent.key" class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs font-semibold text-gray-600 mb-1">{{ agent.icon }} {{ agent.label }}</p>
                <p class="text-xs text-gray-600 leading-relaxed">{{ getAgentContext(agent.key) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-8 flex justify-between">
          <div class="flex gap-3">
            <button @click="goToStep(1)" class="px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium">
              ✏️ Edit
            </button>
            <button
              v-if="isEditMode && companyStore.profile?.website"
              @click="triggerRescrape"
              :disabled="isRescraping"
              class="px-4 py-2.5 text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50"
            >
              {{ isRescraping ? '⏳ Re-analyzing...' : '🔄 Re-analyze AI' }}
            </button>
          </div>
          <button
            @click="goToDashboard"
            class="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            {{ isEditMode ? 'Back to Dashboard' : 'Launch Dashboard 🚀' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useCompanyStore } from '../stores/company'
import { companyApi, elorusApi } from '../api/client'
import { useToastStore } from '../stores/toast'

const toastStore = useToastStore()

const TOTAL_STEPS = 5

const router = useRouter()
const route = useRoute()
const companyStore = useCompanyStore()

const currentStep = ref(1)
const showAgentContexts = ref(false)
const setupError = ref<string | null>(null)
const analysisProgress = ref(-1)
const isEditMode = ref(false)
const isRescraping = ref(false)
const hadExistingCompanies = ref(false)

// KAD codes editing
const editingKad = ref(false)
const kadEditText = ref('')
const savingKad = ref(false)

// Elorus connection test (Step 2)
const testingElorus = ref(false)
const elorusTestResult = ref<boolean | null>(null)
const elorusTestMessage = ref('')

// Elorus save & test (Step 5 - per-company)
const savingElorus = ref(false)
const elorusSaveSuccess = ref(false)
const elorusSaveMessage = ref('')
const elorusConnected = ref(false)
const elorusKeyConfigured = ref(false)

// Form data
const form = ref({
  name: '',
  website: '',
  industry: '',
  gemiNumber: '',
  userText: '',
  pricingModel: '',
  minDealValue: null as number | null,
  maxDealValue: null as number | null,
  keyProducts: [] as Array<{ name: string; description: string; price?: number | null }>,
  uniqueSellingPoints: '',
  communicationLanguage: 'Greek',
  elorusApiKey: '',
  elorusOrganizationId: '',
  elorusBaseUrl: '',
})

// File state
const logoFile = ref<File | null>(null)
const logoPreview = ref<string | null>(null)
const documents = ref<File[]>([])
const logoInput = ref<HTMLInputElement | null>(null)
const docInput = ref<HTMLInputElement | null>(null)

// Computed
const parsedKadCodes = computed<Array<{ code: string; description: string }>>(() => {
  try { return JSON.parse(companyStore.profile?.kad_codes || '[]') } catch { return [] }
})

const parsedKeyProducts = computed<Array<{ name: string; description: string; price?: number }>>(() => {
  try { return JSON.parse(companyStore.profile?.key_products || '[]') } catch { return [] }
})

const analysisSteps = [
  { label: 'Fetching website content' },
  { label: 'Processing documents' },
  { label: 'Crafting your AI team with Claude' },
  { label: 'Saving company profile' },
]

const agentList = [
  { key: 'marketing', icon: '🎯', label: 'Marketing Agent' },
  { key: 'sales',     icon: '💼', label: 'Sales Agent' },
  { key: 'legal',     icon: '⚖️',  label: 'Legal Agent' },
  { key: 'accounting',icon: '📊', label: 'Accounting Agent' },
  { key: 'email',     icon: '📧', label: 'Email Agent' },
]

function pricingModelLabel(val?: string) {
  const map: Record<string, string> = {
    one_time: 'One-time payment',
    subscription: 'Subscription / recurring',
    project_based: 'Project-based',
    hourly: 'Hourly / T&M',
    retainer: 'Retainer',
  }
  return val ? (map[val] || val) : ''
}

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

function goToStep(n: number) {
  currentStep.value = n
}

// Products helpers
function addProduct() {
  form.value.keyProducts.push({ name: '', description: '', price: null })
}
function removeProduct(i: number) {
  form.value.keyProducts.splice(i, 1)
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
  addDocuments(Array.from((e.target as HTMLInputElement).files || []))
}
function handleDocsDrop(e: DragEvent) {
  addDocuments(Array.from(e.dataTransfer?.files || []))
}
function addDocuments(files: File[]) {
  const valid = files.filter(f => f.type === 'application/pdf' || f.type.startsWith('text/'))
  documents.value = [...documents.value, ...valid].slice(0, 10)
}
function removeDoc(index: number) {
  documents.value.splice(index, 1)
}

async function testElorusConnection() {
  testingElorus.value = true
  elorusTestResult.value = null
  elorusTestMessage.value = ''
  try {
    // Save the credentials first so the backend can use them
    const activeId = companyStore.activeCompanyId
    if (activeId) {
      const updates: any = {
        elorus_organization_id: form.value.elorusOrganizationId,
        elorus_base_url: form.value.elorusBaseUrl,
      }
      if (form.value.elorusApiKey) updates.elorus_api_key = form.value.elorusApiKey
      await companyApi.update(updates)
    }
    const { data } = await elorusApi.testConnection()
    if (data.success) {
      elorusTestResult.value = true
      elorusTestMessage.value = 'Connection successful!'
    } else {
      elorusTestResult.value = false
      elorusTestMessage.value = data.message || 'Connection failed'
    }
  } catch (err: any) {
    elorusTestResult.value = false
    elorusTestMessage.value = err.response?.data?.message || err.message || 'Connection failed'
  } finally {
    testingElorus.value = false
  }
}

async function saveElorusCreds() {
  savingElorus.value = true
  elorusSaveMessage.value = ''
  elorusSaveSuccess.value = false
  try {
    const updates: any = {
      elorus_organization_id: form.value.elorusOrganizationId,
      elorus_base_url: form.value.elorusBaseUrl,
    }
    if (form.value.elorusApiKey) updates.elorus_api_key = form.value.elorusApiKey
    await companyApi.update(updates)
    const { data } = await elorusApi.testConnection()
    if (data.success) {
      elorusSaveSuccess.value = true
      elorusSaveMessage.value = 'Saved & connected!'
      elorusConnected.value = true
      elorusKeyConfigured.value = true
      form.value.elorusApiKey = ''
    } else {
      elorusSaveSuccess.value = false
      elorusSaveMessage.value = data.message || 'Saved but connection failed'
      elorusConnected.value = false
    }
  } catch (err: any) {
    elorusSaveSuccess.value = false
    elorusSaveMessage.value = err.response?.data?.message || err.message || 'Failed to save'
    elorusConnected.value = false
  } finally {
    savingElorus.value = false
  }
}

async function startAnalysis() {
  goToStep(4)
  setupError.value = null
  analysisProgress.value = 0

  const stepTimer = setInterval(() => {
    if (analysisProgress.value < 2) analysisProgress.value++
  }, 4000)

  try {
    const fd = new FormData()
    fd.append('name', form.value.name)
    if (form.value.website) fd.append('website', form.value.website)
    if (form.value.industry) fd.append('industry', form.value.industry)
    if (form.value.gemiNumber) fd.append('gemiNumber', form.value.gemiNumber)
    if (form.value.userText) fd.append('userText', form.value.userText)
    if (form.value.pricingModel) fd.append('pricingModel', form.value.pricingModel)
    if (form.value.minDealValue != null) fd.append('minDealValue', String(form.value.minDealValue))
    if (form.value.maxDealValue != null) fd.append('maxDealValue', String(form.value.maxDealValue))
    if (form.value.uniqueSellingPoints) fd.append('uniqueSellingPoints', form.value.uniqueSellingPoints)
    if (form.value.communicationLanguage) fd.append('communicationLanguage', form.value.communicationLanguage)
    if (form.value.elorusApiKey) fd.append('elorusApiKey', form.value.elorusApiKey)
    if (form.value.elorusOrganizationId) fd.append('elorusOrganizationId', form.value.elorusOrganizationId)
    if (form.value.elorusBaseUrl) fd.append('elorusBaseUrl', form.value.elorusBaseUrl)

    const validProducts = form.value.keyProducts.filter(p => p.name.trim())
    if (validProducts.length > 0) {
      fd.append('keyProducts', JSON.stringify(validProducts))
    }

    if (logoFile.value) fd.append('logo', logoFile.value)
    documents.value.forEach(doc => fd.append('documents', doc))

    await companyStore.setupCompany(fd)

    clearInterval(stepTimer)
    analysisProgress.value = 3
    await new Promise(r => setTimeout(r, 800))
    goToStep(5)
  } catch (err: any) {
    clearInterval(stepTimer)
    setupError.value = companyStore.error || 'Unknown error occurred'
  }
}

async function triggerRescrape() {
  isRescraping.value = true
  try {
    await companyStore.rescrapeProfile()
    kadEditText.value = companyStore.profile?.kad_codes || '[]'
  } catch {
    // error set in store
  } finally {
    isRescraping.value = false
  }
}

async function saveKadCodes() {
  savingKad.value = true
  try {
    JSON.parse(kadEditText.value) // validate
    await companyApi.update({ kad_codes: kadEditText.value })
    if (companyStore.profile) companyStore.profile.kad_codes = kadEditText.value
    editingKad.value = false
  } catch {
    toastStore.addToast('Invalid JSON — please check the format.', 'error')
  } finally {
    savingKad.value = false
  }
}

function goToDashboard() {
  const id = companyStore.activeCompanyId
  router.push(id ? `/company/${id}/dashboard` : '/setup')
}

// On mount: pre-fill if editing an existing company
// If ?new=1 is present, start fresh (blank form) regardless of existing profile
onMounted(async () => {
  await companyStore.fetchAllCompanies()
  hadExistingCompanies.value = companyStore.companies.length > 0

  // Creating a new company — skip pre-fill and stay on step 1
  if (route.query.new === '1') return

  if (!companyStore.profile) {
    await companyStore.fetchProfile()
  }
  const p = companyStore.profile
  if (p) {
    isEditMode.value = true
    form.value.name = p.name
    form.value.website = p.website || ''
    form.value.industry = p.industry || ''
    form.value.gemiNumber = p.gemi_number || ''
    form.value.pricingModel = p.pricing_model || ''
    form.value.minDealValue = p.min_deal_value ?? null
    form.value.maxDealValue = p.max_deal_value ?? null
    form.value.uniqueSellingPoints = p.unique_selling_points || ''
    form.value.communicationLanguage = p.communication_language || 'Greek'
    form.value.elorusApiKey = ''
    form.value.elorusOrganizationId = (p as any).elorus_organization_id || ''
    form.value.elorusBaseUrl = (p as any).elorus_base_url || ''
    elorusKeyConfigured.value = !!(p as any).has_elorus_api_key
    elorusConnected.value = !!(elorusKeyConfigured.value && form.value.elorusOrganizationId)
    try {
      form.value.keyProducts = JSON.parse(p.key_products || '[]')
    } catch {
      form.value.keyProducts = []
    }
    kadEditText.value = p.kad_codes || '[]'
    goToStep(5)
  }
})
</script>
