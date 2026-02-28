<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation — hidden on the setup page -->
    <nav v-if="!isSetupPage" class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <router-link to="/dashboard" class="flex items-center space-x-2">
              <!-- Company logo or default icon -->
              <img
                v-if="companyStore.logoUrl"
                :src="companyStore.logoUrl"
                alt="Logo"
                class="h-8 w-8 rounded-lg object-contain"
              />
              <span v-else class="text-2xl">🤖</span>

              <div class="flex flex-col leading-tight">
                <span class="font-bold text-lg text-gray-900 leading-none">
                  {{ companyStore.profile?.name || 'AgentFlow' }}
                </span>
                <span class="text-xs text-gray-400">AI-Powered Company</span>
              </div>
            </router-link>
          </div>
          <div class="flex items-center space-x-1">
            <router-link
              v-for="link in navLinks"
              :key="link.path"
              :to="link.path"
              :class="[
                'px-3 py-2 rounded-md text-sm font-medium',
                route.path.startsWith(link.path) && link.path !== '/'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              ]"
            >
              {{ link.label }}
            </router-link>
            <span class="w-px h-6 bg-gray-200 mx-2"></span>
            <router-link
              to="/help"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Help
            </router-link>
            <router-link
              to="/leads/new"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              + New Lead
            </router-link>
            <router-link
              to="/setup"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:bg-gray-100"
              title="Company Settings"
            >
              ⚙️
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main content -->
    <main :class="isSetupPage ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCompanyStore } from './stores/company'

const route = useRoute()
const companyStore = useCompanyStore()

const isSetupPage = computed(() => route.path === '/setup')

const navLinks = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/leads', label: 'Leads' },
  { path: '/deals', label: 'Deals' },
  { path: '/tasks', label: 'Tasks' },
  { path: '/invoices', label: 'Invoices' },
  { path: '/emails', label: 'Emails' },
]
</script>
