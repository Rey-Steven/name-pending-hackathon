<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation — hidden on the setup page -->
    <nav v-if="!isSetupPage" class="bg-white shadow-sm border-b relative">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">

          <!-- Left: Company switcher -->
          <div class="flex items-center relative" ref="switcherRef">
            <button
              @click="toggleSwitcher"
              class="flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <img
                v-if="companyStore.logoUrl"
                :src="companyStore.logoUrl"
                alt="Logo"
                class="h-8 w-8 rounded-lg object-contain"
              />
              <span v-else class="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-sm">
                {{ companyInitials }}
              </span>
              <div class="flex flex-col leading-tight text-left">
                <span class="font-bold text-base text-gray-900 leading-none">
                  {{ companyStore.profile?.name || 'AgentFlow' }}
                </span>
                <span class="text-xs text-gray-400">{{ companyStore.profile?.industry || 'AI-Powered Company' }}</span>
              </div>
              <svg class="w-4 h-4 text-gray-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Company switcher dropdown -->
            <div
              v-if="switcherOpen"
              class="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden"
            >
              <div class="p-2">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">Companies</p>
                <button
                  v-for="company in companyStore.companies"
                  :key="company.id"
                  @click="switchCompany(company.id)"
                  class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  :class="company.is_active ? 'bg-blue-50' : ''"
                >
                  <div class="h-8 w-8 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                    <img
                      v-if="company.logo_path"
                      :src="`/uploads/${company.logo_path.replace('uploads/', '')}`"
                      class="h-8 w-8 object-contain"
                    />
                    <span v-else class="text-xs font-bold text-gray-500">
                      {{ company.name.slice(0, 2).toUpperCase() }}
                    </span>
                  </div>
                  <div class="flex-1 text-left min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{{ company.name }}</p>
                    <p class="text-xs text-gray-400 truncate">{{ company.industry || company.business_model || '' }}</p>
                  </div>
                  <svg v-if="company.is_active" class="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <button
                    v-if="companyStore.companies.length > 1"
                    @click.stop="removeCompany(company.id)"
                    class="opacity-0 group-hover:opacity-100 ml-1 p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"
                    title="Delete company"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              </div>
              <div class="border-t border-gray-100 p-2">
                <router-link
                  to="/setup?new=1"
                  @click="switcherOpen = false"
                  class="flex items-center space-x-2 w-full px-3 py-2 rounded-lg text-sm text-blue-600 hover:bg-blue-50 font-medium transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Set up new company</span>
                </router-link>
              </div>
            </div>
          </div>

          <!-- Right: Nav links -->
          <div class="flex items-center space-x-1">
            <div
              v-for="item in navItems"
              :key="item.label"
              :class="item.children ? 'relative' : ''"
              :ref="(el) => { if (item.children) setDropdownRef(item.label, el) }"
            >
              <!-- Simple link (no children) -->
              <router-link
                v-if="!item.children"
                :to="companyPath(item.subpath || '')"
                :class="[
                  'px-3 py-2 rounded-md text-sm font-medium',
                  item.subpath && route.path.includes(item.subpath)
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                ]"
              >
                {{ item.label }}
              </router-link>

              <!-- Dropdown department -->
              <template v-else>
                <button
                  @click.stop="toggleDropdown(item.label)"
                  :class="[
                    'px-3 py-2 rounded-md text-sm font-medium inline-flex items-center',
                    isDepartmentActive(item)
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  ]"
                >
                  {{ item.label }}
                  <svg class="w-3.5 h-3.5 ml-1 transition-transform" :class="openDropdown === item.label ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  v-if="openDropdown === item.label"
                  class="absolute top-full left-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1"
                >
                  <router-link
                    v-for="child in item.children"
                    :key="child.subpath"
                    :to="companyPath(child.subpath)"
                    @click="openDropdown = null"
                    :class="[
                      'block px-4 py-2 text-sm',
                      route.path.includes(child.subpath)
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    ]"
                  >
                    {{ child.label }}
                  </router-link>
                </div>
              </template>
            </div>

            <span class="w-px h-6 bg-gray-200 mx-2"></span>
            <router-link
              to="/help"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Help
            </router-link>
            <router-link
              :to="companyPath('leads/new')"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              + New Lead
            </router-link>
            <!-- Gear icon dropdown -->
            <div class="relative" ref="settingsRef">
              <button
                @click.stop="toggleSettings"
                class="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:bg-gray-100"
                title="Settings"
              >
                ⚙️
              </button>
              <div
                v-if="settingsOpen"
                class="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1"
              >
                <router-link
                  to="/setup"
                  @click="settingsOpen = false"
                  class="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  🏢 Company Setup
                </router-link>
                <router-link
                  to="/settings"
                  @click="settingsOpen = false"
                  class="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  ⚙️ Settings
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Company switch loading bar -->
      <div
        v-if="companyStore.isLoading"
        class="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden"
      >
        <div class="h-full w-1/3 bg-blue-500 rounded-full animate-loading-bar" />
      </div>
    </nav>

    <!-- Main content -->
    <main :class="isSetupPage ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'">
      <router-view :key="isSetupPage ? 'setup' : (String(route.params.companyId || 'default'))" />
    </main>

    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCompanyStore } from './stores/company'
import ToastContainer from './components/ToastContainer.vue'

const route = useRoute()
const router = useRouter()
const companyStore = useCompanyStore()

const isSetupPage = computed(() => route.path === '/setup' || route.path.startsWith('/setup'))
const switcherOpen = ref(false)
const switcherRef = ref<HTMLElement | null>(null)
const settingsOpen = ref(false)
const settingsRef = ref<HTMLElement | null>(null)

const companyInitials = computed(() => {
  const name = companyStore.profile?.name || ''
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'A'
})

function companyPath(subpath: string): string {
  const id = companyStore.activeCompanyId
  if (!id) return '/setup'
  return `/company/${id}/${subpath}`
}

function toggleSwitcher() {
  switcherOpen.value = !switcherOpen.value
  settingsOpen.value = false
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value
  switcherOpen.value = false
}

async function switchCompany(id: string) {
  if (id === companyStore.activeCompanyId) {
    switcherOpen.value = false
    return
  }
  await companyStore.activateCompany(id)
  switcherOpen.value = false
  // Navigate to the same sub-page under the new company
  const currentPath = route.path
  const match = currentPath.match(/^\/company\/[^/]+\/(.+)$/)
  const subpath = match ? match[1] : 'dashboard'
  router.push(`/company/${id}/${subpath}`)
}

async function removeCompany(id: string) {
  if (!confirm('Delete this company profile?')) return
  try {
    await companyStore.deleteCompany(id)
  } catch {
    // Axios interceptor shows the error toast
  }
}

// --- Navigation ---

interface NavChild { label: string; subpath: string }
interface NavItem { label: string; subpath?: string; children?: NavChild[] }

const navItems: NavItem[] = [
  { label: 'Dashboard', subpath: 'dashboard' },
  { label: 'Sales', children: [
    { label: 'Leads', subpath: 'leads' },
    { label: 'Deals', subpath: 'deals' },
    { label: 'Contacts', subpath: 'elorus-contacts' },
    { label: 'Products', subpath: 'elorus-products' },
    { label: 'Offers', subpath: 'elorus-offers' },
  ]},
  { label: 'Marketing', children: [
    { label: 'Research', subpath: 'research' },
    { label: 'Content', subpath: 'content' },
  ]},
  { label: 'Accounting', children: [
    { label: 'Invoices', subpath: 'invoices' },
  ]},
  { label: 'Legal', children: [
    { label: 'Reviews', subpath: 'legal/reviews' },
    { label: 'Contracts', subpath: 'legal/contracts' },
  ]},
  { label: 'Operations', children: [
    { label: 'Tasks', subpath: 'tasks' },
    { label: 'Emails', subpath: 'emails' },
  ]},
]

const openDropdown = ref<string | null>(null)
const dropdownRefs: Record<string, HTMLElement | null> = {}

function setDropdownRef(label: string, el: any) {
  dropdownRefs[label] = el as HTMLElement | null
}

function toggleDropdown(label: string) {
  openDropdown.value = openDropdown.value === label ? null : label
}

function isDepartmentActive(item: NavItem): boolean {
  return (item.children || []).some(c => route.path.includes(c.subpath))
}

// --- Click outside ---

function onClickOutside(e: MouseEvent) {
  if (switcherRef.value && !switcherRef.value.contains(e.target as Node)) {
    switcherOpen.value = false
  }
  if (settingsRef.value && !settingsRef.value.contains(e.target as Node)) {
    settingsOpen.value = false
  }
  // Close nav dropdowns
  if (openDropdown.value) {
    const ref = dropdownRefs[openDropdown.value]
    if (ref && !ref.contains(e.target as Node)) {
      openDropdown.value = null
    }
  }
}

onMounted(() => {
  companyStore.fetchAllCompanies()
  document.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style>
@keyframes loading-bar {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
.animate-loading-bar {
  animation: loading-bar 1.2s ease-in-out infinite;
}
</style>
